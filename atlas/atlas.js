/*!
 * Atlas HTML Charts — core runtime
 * https://github.com/DataChart/AtlasHTMLCharts  ·  MIT License
 *
 * No build step. Load after ECharts:
 *   <script src="vendor/echarts/echarts.min.js"></script>
 *   <script src="atlas/atlas.js"></script>
 *   <script src="atlas/visuals.js"></script>
 *
 * A page describes its dashboard declaratively in
 *   <script type="application/json" data-atlas> { ...config... } </script>
 * and Atlas builds the header (logo, title, navigation, upload/download/print
 * buttons), the filter bar (slicers) and the grid of visuals from it.
 * See docs/config-reference.md for every option.
 */
(function (global) {
  'use strict';

  var VERSION = '0.1.0';
  var datasets = Object.create(null);
  var visualTypes = Object.create(null);
  var customFormats = Object.create(null);
  var BLANK = '(Blank)';
  var OTHER = 'Other';

  /* ================================================================== */
  /* DOM helpers & icons                                                 */
  /* ================================================================== */

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, String(v));
      });
    }
    append(el, children);
    return el;
  }
  function append(el, children) {
    if (children == null || children === false) return el;
    if (!Array.isArray(children)) children = [children];
    children.forEach(function (c) {
      if (c == null || c === false) return;
      el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return el;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var ICON_PATHS = {
    upload: '<path d="M12 16V4m0 0-4 4m4-4 4 4"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    download: '<path d="M12 4v12m0 0-4-4m4 4 4-4"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    print: '<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="7" rx="1"/><path d="M7 14h10v6H7z"/>',
    theme: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor"/>',
    table: '<rect x="4" y="5" width="16" height="14" rx="1"/><path d="M4 10h16M4 15h16M10 5v14"/>',
    chart: '<path d="M5 19V9m7 10V5m7 14v-7"/>',
    image: '<rect x="4" y="5" width="16" height="14" rx="1"/><circle cx="9" cy="10" r="1.5"/><path d="m20 16-5-5-8 8"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    reset: '<path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4"/>',
    up: '<path d="M12 19V5m0 0-6 6m6-6 6 6"/>',
    down: '<path d="M12 5v14m0 0-6-6m6 6 6-6"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    alert: '<path d="M12 4 3 20h18L12 4z"/><path d="M12 10v4m0 3v.01"/>'
  };
  function icon(name) {
    var span = document.createElement('span');
    span.innerHTML = '<svg class="atlas-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICON_PATHS[name] || '') + '</svg>';
    return span.firstChild;
  }

  function button(label, iconName, opts) {
    opts = opts || {};
    var cls = 'atlas-btn' + (opts.variant ? ' atlas-btn--' + opts.variant : '') +
      (opts.small ? ' atlas-btn--sm' : '') + (opts.iconOnly ? ' atlas-btn--icon' : '');
    var b = h('button', { type: 'button', class: cls, title: opts.title || label, 'aria-label': label, onclick: opts.onclick });
    if (iconName) b.appendChild(icon(iconName));
    if (!opts.iconOnly) b.appendChild(h('span', { class: 'atlas-btn__label', text: label }));
    return b;
  }

  function toast(message) {
    var t = h('div', { class: 'atlas-toast', role: 'status', text: message });
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }

  function downloadFile(filename, content, mime) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = h('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function slug(s) {
    return String(s || 'dashboard').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'dashboard';
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  /** Current theme tokens, read live from CSS so charts always match the page. */
  function themeTokens() {
    var t = {
      surface: cssVar('--atlas-surface'), surface2: cssVar('--atlas-surface-2'), page: cssVar('--atlas-page'),
      ink: cssVar('--atlas-ink'), ink2: cssVar('--atlas-ink-2'), muted: cssVar('--atlas-ink-muted'),
      grid: cssVar('--atlas-grid'), axis: cssVar('--atlas-axis'), border: cssVar('--atlas-border'),
      accent: cssVar('--atlas-accent'), font: cssVar('--atlas-font'),
      seqLow: cssVar('--atlas-seq-low'), seqMid: cssVar('--atlas-seq-mid'), seqHigh: cssVar('--atlas-seq-high'),
      good: cssVar('--atlas-good'), goodInk: cssVar('--atlas-good-ink'), warning: cssVar('--atlas-warning'),
      serious: cssVar('--atlas-serious'), critical: cssVar('--atlas-critical'),
      palette: []
    };
    for (var i = 1; i <= 8; i++) t.palette.push(cssVar('--atlas-series-' + i));
    return t;
  }

  /* ================================================================== */
  /* Data: parsing, typing, dates, aggregation                           */
  /* ================================================================== */

  /** RFC 4180 CSV parser (quotes, escaped quotes, CRLF). Returns array of row objects. */
  function parseCSV(text) {
    text = String(text).replace(/^﻿/, '');
    var rows = [], row = [], field = '', i = 0, q = false, c;
    var delim = (function () {
      var first = text.split(/\r?\n/, 1)[0] || '';
      var counts = [',', ';', '\t'].map(function (d) { return [d, first.split(d).length]; });
      counts.sort(function (a, b) { return b[1] - a[1]; });
      return counts[0][0];
    })();
    while (i < text.length) {
      c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
        } else field += c;
      } else if (c === '"') q = true;
      else if (c === delim) { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += c;
      i++;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    rows = rows.filter(function (r) { return r.length > 1 || r[0] !== ''; });
    if (!rows.length) return [];
    var header = rows.shift().map(function (x) { return x.trim(); });
    return rows.map(function (r) {
      var o = {};
      header.forEach(function (k, j) { o[k] = r[j] === undefined ? '' : r[j]; });
      return o;
    });
  }

  function toCSV(columns, rows) {
    function cell(v) {
      if (v == null) return '';
      if (v instanceof Date) v = isoDate(v);
      v = String(v);
      return /[",\n\r;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }
    var lines = [columns.map(function (c) { return cell(c.label || c.key); }).join(',')];
    rows.forEach(function (r) {
      lines.push(columns.map(function (c) { return cell(Array.isArray(r) ? r[c.index] : r[c.key]); }).join(','));
    });
    return lines.join('\r\n');
  }

  var DATE_RE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
  var NUM_RE = /^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?(?:[eE][-+]?\d+)?$/;

  function parseDate(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return isNaN(v) ? null : v;
    var s = String(v);
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    var d = new Date(s);
    return isNaN(d) ? null : d;
  }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function isoDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  function humanize(name) {
    return String(name)
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_\-.]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^./, function (c) { return c.toUpperCase(); });
  }

  /** Infer number / date / string for every column. Explicit config always wins. */
  function inferFields(rows, declared) {
    var fields = {};
    var keys = [];
    rows.slice(0, 2000).forEach(function (r) {
      Object.keys(r).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); });
    });
    keys.forEach(function (k) {
      var isNum = true, isDate = true, seen = 0;
      for (var i = 0; i < rows.length && seen < 500; i++) {
        var v = rows[i][k];
        if (v == null || v === '') continue;
        seen++;
        if (typeof v === 'number') { isDate = false; continue; }
        if (v instanceof Date) { isNum = false; continue; }
        var s = String(v).trim();
        if (!NUM_RE.test(s)) isNum = false;
        if (!DATE_RE.test(s)) isDate = false;
        if (!isNum && !isDate) break;
      }
      var type = seen === 0 ? 'string' : isNum ? 'number' : isDate ? 'date' : 'string';
      fields[k] = { name: k, type: type };
    });
    Object.keys(declared || {}).forEach(function (k) {
      fields[k] = Object.assign({ name: k, type: 'string' }, fields[k] || {}, declared[k]);
    });
    Object.keys(fields).forEach(function (k) {
      var f = fields[k];
      if (!f.label) f.label = humanize(k);
      if (!f.format) f.format = f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text';
    });
    return { fields: fields, order: keys };
  }

  function coerceRows(rows, fields) {
    var numKeys = [], dateKeys = [];
    Object.keys(fields).forEach(function (k) {
      if (fields[k].type === 'number') numKeys.push(k);
      if (fields[k].type === 'date') dateKeys.push(k);
    });
    return rows.map(function (r) {
      var o = Object.assign({}, r);
      numKeys.forEach(function (k) {
        var v = o[k];
        if (v === '' || v == null) o[k] = null;
        else if (typeof v !== 'number') { var n = parseFloat(String(v).replace(/,/g, '')); o[k] = isNaN(n) ? null : n; }
      });
      dateKeys.forEach(function (k) { o[k] = parseDate(o[k]); });
      return o;
    });
  }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /** Sortable key for a date at a grain: day | week | month | quarter | year. */
  function grainKey(d, grain) {
    d = parseDate(d);
    if (!d) return BLANK;
    switch (grain) {
      case 'year': return String(d.getFullYear());
      case 'quarter': return d.getFullYear() + '-Q' + (Math.floor(d.getMonth() / 3) + 1);
      case 'month': return d.getFullYear() + '-' + pad(d.getMonth() + 1);
      case 'week': {
        var w = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        w.setDate(w.getDate() - ((w.getDay() + 6) % 7));
        return isoDate(w);
      }
      default: return isoDate(d);
    }
  }
  function grainLabel(key, grain) {
    if (key === BLANK || key === OTHER) return key;
    var p = String(key).split('-');
    switch (grain) {
      case 'year': return key;
      case 'quarter': return p[1] + ' ' + p[0];
      case 'month': return MONTHS[+p[1] - 1] + ' ' + p[0];
      case 'week': return 'Wk of ' + MONTHS[+p[1] - 1] + ' ' + (+p[2]);
      default: return MONTHS[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0];
    }
  }

  var AGGREGATES = {
    sum: function (vals) { var s = 0; vals.forEach(function (v) { if (typeof v === 'number') s += v; }); return s; },
    avg: function (vals) {
      var s = 0, n = 0;
      vals.forEach(function (v) { if (typeof v === 'number') { s += v; n++; } });
      return n ? s / n : null;
    },
    min: function (vals) { var n = vals.filter(isNum); return n.length ? Math.min.apply(null, n) : null; },
    max: function (vals) { var n = vals.filter(isNum); return n.length ? Math.max.apply(null, n) : null; },
    median: function (vals) {
      var n = vals.filter(isNum).sort(function (a, b) { return a - b; });
      if (!n.length) return null;
      var m = Math.floor(n.length / 2);
      return n.length % 2 ? n[m] : (n[m - 1] + n[m]) / 2;
    },
    count: function (vals) { return vals.filter(function (v) { return v != null && v !== ''; }).length; },
    distinct: function (vals) {
      var s = new Set();
      vals.forEach(function (v) { if (v != null && v !== '') s.add(v instanceof Date ? +v : v); });
      return s.size;
    }
  };
  AGGREGATES.average = AGGREGATES.avg;
  AGGREGATES.countDistinct = AGGREGATES.distinct;
  function isNum(v) { return typeof v === 'number' && !isNaN(v); }

  function groupBy(rows, keyFn) {
    var map = new Map();
    rows.forEach(function (r) {
      var k = keyFn(r);
      var bucket = map.get(k);
      if (!bucket) map.set(k, bucket = []);
      bucket.push(r);
    });
    return map;
  }

  /* ================================================================== */
  /* Formatting                                                          */
  /* ================================================================== */

  function createFormatter(locale, currency) {
    var cache = {};
    function nf(key, opts) { return cache[key] || (cache[key] = new Intl.NumberFormat(locale, opts)); }
    function format(value, fmt) {
      if (value == null || value === '' || (typeof value === 'number' && isNaN(value))) return '–';
      if (typeof fmt === 'function') return fmt(value);
      if (fmt && customFormats[fmt]) return customFormats[fmt](value, { locale: locale, currency: currency });
      if (value instanceof Date) {
        if (fmt === 'month') return value.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
        if (fmt === 'datetime') return value.toLocaleString(locale);
        return value.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
      }
      if (typeof value !== 'number') return String(value);
      var abs = Math.abs(value);
      switch (fmt) {
        case 'currency':
          return nf('cur' + (abs >= 1000 ? 0 : 2), { style: 'currency', currency: currency, maximumFractionDigits: abs >= 1000 ? 0 : 2, minimumFractionDigits: 0 }).format(value);
        case 'compactCurrency':
          return nf('ccur', { style: 'currency', currency: currency, notation: 'compact', maximumFractionDigits: 1 }).format(value);
        case 'percent': return nf('pct', { style: 'percent', maximumFractionDigits: 1 }).format(value);
        case 'compact': return nf('cmp', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
        case 'integer': return nf('int', { maximumFractionDigits: 0 }).format(value);
        case 'decimal': return nf('dec', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
        case 'text': return String(value);
        default: return nf('num' + (abs >= 100 ? 0 : 2), { maximumFractionDigits: abs >= 100 ? 0 : 2 }).format(value);
      }
    }
    return format;
  }
  function safeLocale(locale) {
    try { new Intl.NumberFormat(locale); return locale; } catch (e) { return 'en-US'; }
  }
  /** Shorter format for axis ticks. */
  function axisFormat(fmt) {
    if (fmt === 'currency' || fmt === 'compactCurrency') return 'compactCurrency';
    if (fmt === 'percent') return 'percent';
    if (typeof fmt === 'function') return fmt;
    return 'compact';
  }

  /* ================================================================== */
  /* Dashboard                                                           */
  /* ================================================================== */

  function Dashboard(config, mount) {
    if (!(this instanceof Dashboard)) return new Dashboard(config, mount);
    this.config = config = Object.assign({ toolbar: {}, filters: [], visuals: [], nav: [] }, config);
    this.mount = mount || document.getElementById('atlas') || document.body.appendChild(h('div', { id: 'atlas' }));
    this.format = createFormatter(safeLocale(config.locale || navigator.language), config.currency || 'USD');
    this.records = [];
    this.filterState = {};
    this.cross = null;
    this.pageFilters = [];
    this._colorMaps = {};
    this._uid = 0;
    var rows = resolveData(config.data);
    this.setData(rows, config.dataName || (typeof config.data === 'string' ? config.data : 'data'), true);
    this.pageFilters = readUrlFilters(this);
    this.render();
    var self = this;
    global.addEventListener('beforeprint', function () { self._beforePrint(); });
    global.addEventListener('afterprint', function () { self.resize(); });
  }

  function resolveData(data) {
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
      if (datasets[data]) return datasets[data];
      console.warn('[Atlas] Dataset "' + data + '" is not registered. Did the data <script> load before atlas config? ' +
        'Registered datasets: ' + Object.keys(datasets).join(', '));
    }
    return [];
  }

  Dashboard.prototype.setData = function (rows, name, silent) {
    var inferred = inferFields(rows || [], this.config.fields);
    this.fields = inferred.fields;
    this.fieldOrder = inferred.order.concat(Object.keys(this.fields).filter(function (k) { return inferred.order.indexOf(k) < 0; }));
    this.rows = coerceRows(rows || [], this.fields);
    this.dataName = name || 'data';
    this._colorMaps = {};
    if (!silent) {
      this.cross = null;
      this.filterState = {};
      this.renderFilters();
      this.refresh();
    }
  };

  Dashboard.prototype.field = function (name) {
    return this.fields[name] || { name: name, type: 'string', label: humanize(name || ''), format: 'text', missing: true };
  };
  Dashboard.prototype.label = function (name) { return this.field(name).label; };

  /** Stable colour for an entity: same value -> same colour, no matter which filters are on. */
  Dashboard.prototype.colorFor = function (field, value, tokens) {
    tokens = tokens || themeTokens();
    if (value === OTHER || value === BLANK) return tokens.muted;
    var map = this._colorMaps[field];
    if (!map) {
      var counts = new Map();
      this.rows.forEach(function (r) {
        var v = r[field]; v = v instanceof Date ? isoDate(v) : v;
        counts.set(v, (counts.get(v) || 0) + 1);
      });
      map = new Map();
      Array.from(counts.entries()).sort(function (a, b) { return b[1] - a[1]; })
        .forEach(function (e, i) { map.set(String(e[0]), i); });
      this._colorMaps[field] = map;
    }
    var idx = map.get(String(value));
    return idx != null && idx < 8 ? tokens.palette[idx] : tokens.muted;
  };

  /* ---------------- Filtering ---------------- */

  Dashboard.prototype.filteredRows = function (visualId) {
    var self = this;
    var active = (this.config.filters || []).map(function (f, i) {
      var id = filterId(f, i);
      return { def: f, state: self.filterState[id] };
    }).filter(function (x) { return isActive(x.def, x.state); });
    var cross = this.cross && this.cross.source !== visualId ? this.cross : null;
    var pageF = this.pageFilters;
    if (!active.length && !cross && !pageF.length) return this.rows;
    return this.rows.filter(function (r) {
      for (var i = 0; i < active.length; i++) if (!matchFilter(r, active[i].def, active[i].state)) return false;
      for (var j = 0; j < pageF.length; j++) if (!matchValue(r, pageF[j])) return false;
      if (cross && !matchValue(r, cross)) return false;
      return true;
    });
  };

  function filterId(f, i) { return f.id || (f.type + ':' + (f.field || (f.fields || []).join('+') || i)); }

  function isActive(def, st) {
    if (st == null) return false;
    switch (def.type) {
      case 'dateRange': return !!(st.from || st.to);
      case 'range': return st.min != null || st.max != null;
      case 'search': return !!st;
      default: return st instanceof Set ? st.size > 0 : st !== '' && st != null;
    }
  }

  function keyOf(v) { return v instanceof Date ? isoDate(v) : v == null || v === '' ? BLANK : String(v); }

  function matchValue(row, m) {
    var v = row[m.field];
    var k = m.grain ? grainKey(v, m.grain) : keyOf(v);
    return Array.isArray(m.value) ? m.value.indexOf(k) >= 0 : k === String(m.value);
  }

  function matchFilter(row, def, st) {
    var v = row[def.field];
    switch (def.type) {
      case 'dateRange': {
        var d = parseDate(v);
        if (!d) return false;
        if (st.from && d < st.from) return false;
        if (st.to && d > st.to) return false;
        return true;
      }
      case 'range':
        if (typeof v !== 'number') return false;
        if (st.min != null && v < st.min) return false;
        if (st.max != null && v > st.max) return false;
        return true;
      case 'search': {
        var q = String(st).toLowerCase();
        var fields = def.fields || [def.field];
        return fields.some(function (f) { return row[f] != null && String(keyOf(row[f])).toLowerCase().indexOf(q) >= 0; });
      }
      default:
        return st.has(keyOf(v));
    }
  }

  function readUrlFilters(dash) {
    var out = [];
    try {
      new URLSearchParams(global.location.search).forEach(function (value, key) {
        var parts = key.split(':');
        if (!dash.fields[parts[0]]) return;
        out.push({ field: parts[0], grain: parts[1] || null, value: value, page: true });
      });
    } catch (e) { /* file:// or sandboxed — ignore */ }
    return out;
  }

  Dashboard.prototype.setCrossFilter = function (field, value, grain, source) {
    if (this.cross && this.cross.source === source && this.cross.field === field && this.cross.value === value) this.cross = null;
    else this.cross = { field: field, value: value, grain: grain || null, source: source };
    this.refresh();
  };

  /**
   * Open another page filtered to the clicked value (Power BI "drill through").
   * The target page reads ?field=value (or ?field:grain=key) and shows it as a removable chip.
   */
  Dashboard.prototype.drillThrough = function (target, field, value, grain, extra) {
    var href = typeof target === 'string' ? target : target.href;
    var params = new URLSearchParams();
    var put = function (f, g, v) { params.set(f + (g ? ':' + g : ''), v); };
    this.pageFilters.forEach(function (p) { put(p.field, p.grain, p.value); });
    if (target.keepFilters !== false && this.cross && this.cross.field !== field) put(this.cross.field, this.cross.grain, this.cross.value);
    (extra || []).forEach(function (x) { put(x.field, x.grain, x.value); });
    put(field, grain, value);
    global.location.href = href + (href.indexOf('?') >= 0 ? '&' : '?') + params.toString();
  };

  /* ---------------- Rendering ---------------- */

  Dashboard.prototype.render = function () {
    var c = this.config;
    this.mount.innerHTML = '';
    this.mount.classList.add('atlas-root');
    if (c.title && !document.title) document.title = c.title;
    if (c.header !== false) this.mount.appendChild(this.renderHeader());
    var main = h('main', { class: 'atlas-main', id: 'atlas-main' });
    this.printSummary = h('p', { class: 'atlas-print-only atlas-print-summary' });
    this.filterBar = h('div', { class: 'atlas-filters', role: 'search', 'aria-label': 'Filters' });
    this.grid = h('div', { class: 'atlas-grid' });
    append(main, [this.printSummary, this.filterBar, this.grid]);
    this.mount.appendChild(main);
    this.renderFilters();
    this.renderVisuals();
    this.refresh();
    var self = this;
    document.addEventListener('click', function (e) {
      document.querySelectorAll('details.atlas-menu[open], details.atlas-dropdown[open]').forEach(function (d) {
        if (!d.contains(e.target)) d.removeAttribute('open');
      });
    });
    if (c.toolbar.upload !== false) enableDrop(this);
    if (global.matchMedia) {
      var mq = global.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function () { self.refresh(); };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
    }
  };

  Dashboard.prototype.renderHeader = function () {
    var c = this.config, self = this;
    var brand = h(c.logoHref ? 'a' : 'div', { class: 'atlas-brand', href: c.logoHref });
    if (c.logo !== false) {
      var img = h('img', { class: 'atlas-logo', src: c.logo || 'assets/logo.svg', alt: (c.logoAlt || c.title || 'Logo') });
      img.addEventListener('error', function () { img.remove(); });
      brand.appendChild(img);
    }
    append(brand, h('div', { class: 'atlas-brand__text' }, [
      c.title ? h('h1', { class: 'atlas-title', text: c.title }) : null,
      c.subtitle ? h('span', { class: 'atlas-subtitle', text: c.subtitle }) : null
    ]));

    var nav = null;
    if (c.nav && c.nav.length) {
      var here = normalizePath(global.location.href);
      nav = h('nav', { class: 'atlas-nav', 'aria-label': 'Dashboard pages' }, h('ul', null, c.nav.map(function (item) {
        var isActive = item.active != null ? item.active : normalizePath(item.href) === here;
        return h('li', null, h('a', { href: item.href, 'aria-current': isActive ? 'page' : null, text: item.label }));
      })));
    }

    var tb = c.toolbar, tools = h('div', { class: 'atlas-toolbar' });
    if (tb.upload !== false) {
      var input = h('input', { type: 'file', accept: '.csv,.json,.txt,.tsv', hidden: true, 'aria-hidden': 'true' });
      input.addEventListener('change', function () {
        if (input.files && input.files[0]) loadFile(self, input.files[0]);
        input.value = '';
      });
      append(tools, [input, button(tb.uploadLabel || 'Upload', 'upload', {
        title: 'Load a CSV or JSON file into this dashboard', onclick: function () { input.click(); }
      })]);
    }
    if (tb.download !== false) tools.appendChild(this.renderDownloadMenu());
    if (tb.print !== false) {
      tools.appendChild(button(tb.printLabel || 'Print', 'print', { title: 'Print or save as PDF', onclick: function () { self.print(); } }));
    }
    if (tb.theme !== false) {
      tools.appendChild(button('Toggle light / dark theme', 'theme', { iconOnly: true, variant: 'ghost', onclick: function () { self.toggleTheme(); } }));
    }
    (tb.custom || []).forEach(function (b) {
      tools.appendChild(h('a', { class: 'atlas-btn', href: b.href, target: b.target, text: b.label }));
    });

    return h('header', { class: 'atlas-header' }, h('div', { class: 'atlas-header__inner' }, [brand, nav, tools]));
  };

  Dashboard.prototype.renderDownloadMenu = function () {
    var self = this, base = slug(this.config.title);
    var cols = function () {
      return self.fieldOrder.map(function (k) { return { key: k, label: k }; });
    };
    var items = [
      ['Filtered data (CSV)', function () { downloadFile(base + '-filtered.csv', toCSV(cols(), self.filteredRows()), 'text/csv'); }],
      ['All data (CSV)', function () { downloadFile(base + '-all.csv', toCSV(cols(), self.rows), 'text/csv'); }],
      ['Filtered data (JSON)', function () {
        downloadFile(base + '-filtered.json', JSON.stringify(self.filteredRows().map(serializeRow), null, 2), 'application/json');
      }],
      ['Dashboard config (JSON)', function () {
        var cfg = Object.assign({}, self.config);
        if (Array.isArray(cfg.data)) cfg.data = self.dataName;
        downloadFile(base + '.atlas.json', JSON.stringify(cfg, null, 2), 'application/json');
      }]
    ];
    var label = this.config.toolbar.downloadLabel || 'Download';
    var summary = h('summary', { class: 'atlas-btn', title: 'Download data', 'aria-label': label }, [icon('download'), h('span', { class: 'atlas-btn__label', text: label })]);
    var panel = h('div', { class: 'atlas-menu__panel', role: 'menu' }, items.map(function (it) {
      return h('button', {
        type: 'button', class: 'atlas-menu__item', role: 'menuitem', text: it[0],
        onclick: function (e) { it[1](); e.target.closest('details').removeAttribute('open'); }
      });
    }));
    return h('details', { class: 'atlas-menu' }, [summary, panel]);
  };

  function serializeRow(r) {
    var o = {};
    Object.keys(r).forEach(function (k) { o[k] = r[k] instanceof Date ? isoDate(r[k]) : r[k]; });
    return o;
  }

  /** Absolute path of a link, with a trailing "/" treated as "/index.html". */
  function normalizePath(href) {
    if (!href) return '';
    try {
      var p = new URL(href, global.location.href).pathname;
      return /\/$/.test(p) ? p + 'index.html' : p;
    } catch (e) { return String(href); }
  }

  function loadFile(dash, file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var text = String(reader.result), rows;
        if (/\.json$/i.test(file.name) || /^\s*[[{]/.test(text)) {
          var parsed = JSON.parse(text);
          rows = Array.isArray(parsed) ? parsed : parsed.rows || parsed.data || [];
        } else rows = parseCSV(text);
        if (!rows.length) throw new Error('No rows found');
        dash.setData(rows, file.name.replace(/\.[^.]+$/, ''));
        toast('Loaded ' + rows.length.toLocaleString() + ' rows from ' + file.name);
      } catch (err) {
        console.error('[Atlas] Could not read file', err);
        toast('Could not read ' + file.name + ': ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  function enableDrop(dash) {
    document.addEventListener('dragover', function (e) {
      if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') >= 0) e.preventDefault();
    });
    document.addEventListener('drop', function (e) {
      if (!e.dataTransfer || !e.dataTransfer.files.length) return;
      e.preventDefault();
      loadFile(dash, e.dataTransfer.files[0]);
    });
  }

  Dashboard.prototype.print = function () {
    this._beforePrint();
    global.print();
  };
  Dashboard.prototype._beforePrint = function () {
    var parts = this.activeFilterLabels();
    this.printSummary.textContent = (parts.length ? 'Filters: ' + parts.join(' · ') : 'No filters applied') +
      ' · Printed ' + new Date().toLocaleString();
  };

  Dashboard.prototype.toggleTheme = function () {
    var root = document.documentElement;
    var current = root.getAttribute('data-theme') ||
      (global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('atlas-theme', next); } catch (e) { /* storage unavailable */ }
    this.refresh();
  };

  /* ---------------- Filter bar ---------------- */

  Dashboard.prototype.renderFilters = function () {
    if (!this.filterBar) return;
    var self = this, bar = this.filterBar;
    bar.innerHTML = '';
    (this.config.filters || []).forEach(function (def, i) {
      var id = filterId(def, i);
      if (!(id in self.filterState)) self.filterState[id] = initialFilterState(self, def);
      var ctl = buildFilter(self, def, id);
      if (ctl) bar.appendChild(ctl);
    });
    this.chips = h('div', { class: 'atlas-chips', 'aria-live': 'polite' });
    var actions = h('div', { class: 'atlas-filters__actions' });
    if ((this.config.filters || []).length) {
      actions.appendChild(button('Reset filters', 'reset', {
        variant: 'ghost', onclick: function () {
          self.filterState = {};
          self.cross = null;
          self.renderFilters();
          self.refresh();
        }
      }));
    }
    append(bar, [actions, this.chips]);
  };

  function distinctValues(dash, field) {
    var meta = dash.field(field), seen = new Map();
    dash.rows.forEach(function (r) { var k = keyOf(r[field]); if (!seen.has(k)) seen.set(k, r[field]); });
    var keys = Array.from(seen.keys());
    if (meta.type === 'number') keys.sort(function (a, b) { return (+a) - (+b); });
    else keys.sort(function (a, b) { return a === BLANK ? 1 : b === BLANK ? -1 : a.localeCompare(b, undefined, { numeric: true }); });
    return keys;
  }

  function dataExtent(dash, field) {
    var min = null, max = null;
    dash.rows.forEach(function (r) {
      var v = r[field];
      if (v == null) return;
      if (min == null || v < min) min = v;
      if (max == null || v > max) max = v;
    });
    return [min, max];
  }

  var DATE_PRESETS = [
    ['all', 'All time'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['90d', 'Last 90 days'],
    ['12m', 'Last 12 months'], ['mtd', 'Month to date'], ['qtd', 'Quarter to date'], ['ytd', 'Year to date'], ['custom', 'Custom range']
  ];
  /** Presets are anchored to the latest date in the data, so static data sets stay meaningful. */
  function presetRange(dash, field, preset) {
    var ext = dataExtent(dash, field), end = ext[1];
    if (!end || preset === 'all' || !preset) return { from: null, to: null, preset: 'all' };
    var from = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    switch (preset) {
      case '7d': from.setDate(from.getDate() - 6); break;
      case '30d': from.setDate(from.getDate() - 29); break;
      case '90d': from.setDate(from.getDate() - 89); break;
      case '12m': from.setFullYear(from.getFullYear() - 1); from.setDate(from.getDate() + 1); break;
      case 'mtd': from.setDate(1); break;
      case 'qtd': from = new Date(end.getFullYear(), Math.floor(end.getMonth() / 3) * 3, 1); break;
      case 'ytd': from = new Date(end.getFullYear(), 0, 1); break;
      default: return { from: null, to: null, preset: 'all' };
    }
    return { from: from, to: end, preset: preset };
  }

  function initialFilterState(dash, def) {
    var d = def.default;
    switch (def.type) {
      case 'dateRange':
        if (d && typeof d === 'object') return { from: parseDate(d.from), to: parseDate(d.to), preset: 'custom' };
        return presetRange(dash, def.field, d || 'all');
      case 'range': return { min: d && d.min != null ? d.min : null, max: d && d.max != null ? d.max : null };
      case 'search': return d || '';
      default:
        return new Set(d == null ? [] : (Array.isArray(d) ? d : [d]).map(String));
    }
  }

  function buildFilter(dash, def, id) {
    var label = def.label || (def.field ? dash.label(def.field) : 'Search');
    var st = dash.filterState[id];
    var labelId = 'atlas-f-' + (++dash._uid);
    var wrap = h('div', { class: 'atlas-filter atlas-filter--' + def.type, role: 'group', 'aria-labelledby': labelId },
      h('span', { class: 'atlas-filter__label', id: labelId, text: label }));
    if (def.field && dash.field(def.field).missing && def.type !== 'search') {
      console.warn('[Atlas] Filter "' + label + '" uses unknown field "' + def.field + '"');
    }
    var changed = function () { dash.refresh(); };

    switch (def.type) {
      case 'dropdown': {
        var values = def.options || distinctValues(dash, def.field);
        if (def.multiple === false) {
          var sel = h('select', { class: 'atlas-input', 'aria-labelledby': labelId },
            [h('option', { value: '', text: def.allLabel || 'All' })].concat(values.map(function (v) {
              return h('option', { value: v, text: v, selected: st.has(String(v)) });
            })));
          sel.addEventListener('change', function () {
            st.clear(); if (sel.value) st.add(sel.value); changed();
          });
          wrap.appendChild(sel);
        } else {
          wrap.appendChild(multiSelect(values, st, def, changed));
        }
        break;
      }
      case 'list': {
        wrap.appendChild(checklist(def.options || distinctValues(dash, def.field), st, changed));
        break;
      }
      case 'buttons': {
        var tiles = h('div', { class: 'atlas-tiles' });
        (def.options || distinctValues(dash, def.field)).forEach(function (v) {
          var b = h('button', { type: 'button', class: 'atlas-tile', 'aria-pressed': st.has(String(v)) ? 'true' : 'false', text: v });
          b.addEventListener('click', function () {
            if (def.multiple === false) {
              var was = st.has(String(v));
              st.clear();
              tiles.querySelectorAll('.atlas-tile').forEach(function (t) { t.setAttribute('aria-pressed', 'false'); });
              if (!was) st.add(String(v));
            } else if (st.has(String(v))) st.delete(String(v));
            else st.add(String(v));
            b.setAttribute('aria-pressed', st.has(String(v)) ? 'true' : 'false');
            changed();
          });
          tiles.appendChild(b);
        });
        wrap.appendChild(tiles);
        break;
      }
      case 'dateRange': {
        var preset = h('select', { class: 'atlas-input', 'aria-label': label + ' preset' },
          DATE_PRESETS.map(function (p) { return h('option', { value: p[0], text: p[1], selected: st.preset === p[0] }); }));
        var from = h('input', { class: 'atlas-input', type: 'date', 'aria-label': label + ' from' });
        var to = h('input', { class: 'atlas-input', type: 'date', 'aria-label': label + ' to' });
        var sync = function () {
          from.value = st.from ? isoDate(st.from) : '';
          to.value = st.to ? isoDate(st.to) : '';
        };
        preset.addEventListener('change', function () {
          if (preset.value === 'custom') return;
          Object.assign(st, presetRange(dash, def.field, preset.value));
          sync(); changed();
        });
        [from, to].forEach(function (inp) {
          inp.addEventListener('change', function () {
            st.from = parseDate(from.value); st.to = parseDate(to.value); st.preset = 'custom';
            preset.value = 'custom'; changed();
          });
        });
        sync();
        wrap.appendChild(h('div', { class: 'atlas-filter__row' }, [preset, from, h('span', { text: '–', 'aria-hidden': 'true' }), to]));
        break;
      }
      case 'range': {
        var ext = dataExtent(dash, def.field);
        var mk = function (key, ph) {
          var inp = h('input', {
            class: 'atlas-input', type: 'number', step: def.step || 'any', placeholder: ph,
            'aria-label': label + ' ' + key, value: st[key] != null ? st[key] : null
          });
          inp.addEventListener('change', function () { st[key] = inp.value === '' ? null : +inp.value; changed(); });
          return inp;
        };
        wrap.appendChild(h('div', { class: 'atlas-filter__row' }, [
          mk('min', ext[0] != null ? 'Min ' + dash.format(ext[0], 'compact') : 'Min'),
          h('span', { text: '–', 'aria-hidden': 'true' }),
          mk('max', ext[1] != null ? 'Max ' + dash.format(ext[1], 'compact') : 'Max')
        ]));
        break;
      }
      case 'search': {
        var timer;
        var s = h('input', { class: 'atlas-input', type: 'search', placeholder: def.placeholder || 'Search…', 'aria-labelledby': labelId, value: st || null });
        s.addEventListener('input', function () {
          clearTimeout(timer);
          timer = setTimeout(function () { dash.filterState[id] = s.value.trim(); changed(); }, 200);
        });
        wrap.appendChild(s);
        break;
      }
      default:
        console.warn('[Atlas] Unknown filter type "' + def.type + '". Use dropdown, list, buttons, dateRange, range or search.');
        return null;
    }
    return wrap;
  }

  function checklist(values, st, changed, onUpdate) {
    var list = h('div', { class: 'atlas-checklist' });
    values.forEach(function (v) {
      var cb = h('input', { type: 'checkbox', value: v, checked: st.has(String(v)) });
      cb.addEventListener('change', function () {
        if (cb.checked) st.add(String(v)); else st.delete(String(v));
        if (onUpdate) onUpdate();
        changed();
      });
      list.appendChild(h('label', { class: 'atlas-check', 'data-value': String(v).toLowerCase() }, [cb, h('span', { text: v })]));
    });
    return list;
  }

  function multiSelect(values, st, def, changed) {
    var valueText = h('span', { class: 'atlas-dropdown__value' });
    var update = function () {
      var n = st.size;
      valueText.textContent = n === 0 ? (def.allLabel || 'All') : n === 1 ? Array.from(st)[0] : n + ' selected';
    };
    var list = checklist(values, st, changed, update);
    var panel = h('div', { class: 'atlas-dropdown__panel' });
    if (values.length > 8) {
      var search = h('input', { class: 'atlas-input atlas-dropdown__search', type: 'search', placeholder: 'Search…', 'aria-label': 'Search options' });
      search.addEventListener('input', function () {
        var q = search.value.toLowerCase();
        list.querySelectorAll('.atlas-check').forEach(function (l) { l.hidden = l.getAttribute('data-value').indexOf(q) < 0; });
      });
      panel.appendChild(search);
    }
    panel.appendChild(list);
    panel.appendChild(h('div', { class: 'atlas-filter__row', style: { marginTop: '6px' } }, [
      button('Clear', null, {
        small: true, variant: 'ghost', onclick: function () {
          st.clear(); list.querySelectorAll('input').forEach(function (c) { c.checked = false; }); update(); changed();
        }
      })
    ]));
    update();
    var summary = h('summary', null, [valueText, icon('chevron')]);
    return h('details', { class: 'atlas-dropdown' }, [summary, panel]);
  }

  Dashboard.prototype.activeFilterLabels = function () {
    var self = this, out = [];
    (this.config.filters || []).forEach(function (def, i) {
      var st = self.filterState[filterId(def, i)];
      if (!isActive(def, st)) return;
      var name = def.label || (def.field ? self.label(def.field) : 'Search');
      if (def.type === 'dateRange') out.push(name + ': ' + (st.from ? self.format(st.from, 'date') : '…') + ' – ' + (st.to ? self.format(st.to, 'date') : '…'));
      else if (def.type === 'range') out.push(name + ': ' + (st.min != null ? st.min : '…') + ' – ' + (st.max != null ? st.max : '…'));
      else if (def.type === 'search') out.push(name + ': "' + st + '"');
      else out.push(name + ': ' + Array.from(st).join(', '));
    });
    this.pageFilters.forEach(function (p) { out.push(self.label(p.field) + ': ' + displayKey(p.value, p.grain)); });
    if (this.cross) out.push(this.label(this.cross.field) + ': ' + displayKey(this.cross.value, this.cross.grain));
    return out;
  };

  function displayKey(value, grain) { return grain ? grainLabel(value, grain) : value; }

  Dashboard.prototype.renderChips = function () {
    var self = this;
    if (!this.chips) return;
    this.chips.innerHTML = '';
    this.pageFilters.forEach(function (p, i) {
      self.chips.appendChild(chip(self.label(p.field) + ': ' + displayKey(p.value, p.grain), 'Remove drill-through filter', function () {
        self.pageFilters.splice(i, 1);
        try {
          var url = new URL(global.location.href);
          url.searchParams.delete(p.field + (p.grain ? ':' + p.grain : ''));
          global.history.replaceState(null, '', url.toString());
        } catch (e) { /* ignore */ }
        self.refresh();
      }));
    });
    if (this.cross) {
      var c = this.cross;
      this.chips.appendChild(chip(this.label(c.field) + ': ' + displayKey(c.value, c.grain), 'Clear selection', function () {
        self.cross = null; self.refresh();
      }));
    }
  };

  function chip(text, title, onRemove) {
    return h('button', { type: 'button', class: 'atlas-chip', title: title, onclick: onRemove }, [h('span', { text: text }), icon('close')]);
  }

  /* ---------------- Visual grid ---------------- */

  Dashboard.prototype.renderVisuals = function () {
    var self = this;
    this.grid.innerHTML = '';
    this.records.forEach(function (r) { if (r.chart) r.chart.dispose(); if (r.ro) r.ro.disconnect(); });
    this.records = [];
    (this.config.visuals || []).forEach(function (v, i) {
      if (v.type === 'section') {
        self.grid.appendChild(h('h2', { class: 'atlas-section-title', text: v.title || '' }));
        return;
      }
      var rec = { id: v.id || 'v' + i, config: v, state: {}, showTable: false, table: null };
      var type = visualTypes[v.type];
      var span = Math.max(1, Math.min(12, parseInt(v.span, 10) || (type && type.meta.span) || 6));
      var titleId = 'atlas-t-' + rec.id;
      rec.titleEl = h('h3', { class: 'atlas-visual__title', id: titleId, text: v.title || '' });
      rec.content = h('div', { class: 'atlas-visual__content' });
      rec.dataview = h('div', { class: 'atlas-dataview', hidden: true });
      rec.actions = h('div', { class: 'atlas-visual__actions atlas-no-print' });
      rec.el = h('section', { class: 'atlas-visual atlas-span-' + span, 'aria-labelledby': titleId, 'data-visual-type': v.type, 'data-visual-id': rec.id }, [
        h('div', { class: 'atlas-visual__head' }, [
          h('div', { class: 'atlas-visual__titles' }, [rec.titleEl, v.subtitle ? h('div', { class: 'atlas-visual__subtitle', text: v.subtitle }) : null]),
          rec.actions
        ]),
        h('div', { class: 'atlas-visual__body' }, [rec.content, rec.dataview])
      ]);
      if (!v.title) rec.titleEl.classList.add('atlas-sr-only'), rec.titleEl.textContent = humanize(v.type);
      self.buildActions(rec, type);
      self.grid.appendChild(rec.el);
      self.records.push(rec);
    });
  };

  Dashboard.prototype.buildActions = function (rec, type) {
    var self = this, v = rec.config;
    if (!type || v.actions === false) return;
    if (type.meta.chart) {
      var tbtn = button('Show data table', 'table', { iconOnly: true, small: true, variant: 'ghost' });
      tbtn.addEventListener('click', function () {
        rec.showTable = !rec.showTable;
        tbtn.setAttribute('aria-pressed', String(rec.showTable));
        tbtn.title = rec.showTable ? 'Show chart' : 'Show data table';
        tbtn.replaceChild(icon(rec.showTable ? 'chart' : 'table'), tbtn.firstChild);
        self.applyView(rec);
      });
      rec.actions.appendChild(tbtn);
      rec.actions.appendChild(button('Download image (PNG)', 'image', {
        iconOnly: true, small: true, variant: 'ghost', onclick: function () {
          if (!rec.chart) return;
          var url = rec.chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: themeTokens().surface });
          var a = h('a', { href: url, download: slug(v.title || v.type) + '.png' });
          document.body.appendChild(a); a.click(); a.remove();
        }
      }));
    }
    rec.actions.appendChild(button('Download data (CSV)', 'download', {
      iconOnly: true, small: true, variant: 'ghost', onclick: function () {
        if (!rec.table) return toast('No data to download');
        downloadFile(slug(v.title || v.type) + '.csv', toCSV(rec.table.columns, rec.table.rows), 'text/csv');
      }
    }));
  };

  Dashboard.prototype.applyView = function (rec) {
    rec.content.hidden = rec.showTable;
    rec.dataview.hidden = !rec.showTable;
    if (rec.showTable) {
      rec.dataview.innerHTML = '';
      rec.dataview.appendChild(rec.table ? renderTable(this, rec.table) : h('div', { class: 'atlas-empty', text: 'No data' }));
    } else if (rec.chart) rec.chart.resize();
  };

  /** Re-run every visual against the current filters. */
  Dashboard.prototype.refresh = function () {
    var self = this;
    this.renderChips();
    var tokens = themeTokens();
    this.records.forEach(function (rec) { self.renderVisual(rec, tokens); });
  };

  Dashboard.prototype.resize = function () {
    this.records.forEach(function (r) { if (r.chart) r.chart.resize(); });
  };

  Dashboard.prototype.renderVisual = function (rec, tokens) {
    var v = rec.config, type = visualTypes[v.type];
    var ctx = new VisualContext(this, rec, tokens || themeTokens());
    rec.table = null;
    rec._chartUsed = false;
    rec.content.innerHTML = '';
    try {
      if (!type) throw new Error('Unknown visual type "' + v.type + '". Known types: ' + Object.keys(visualTypes).sort().join(', '));
      ctx.checkFields();
      type.render(ctx, type.preset || {});
    } catch (err) {
      console.error('[Atlas] Visual "' + (v.title || v.type) + '" failed:', err);
      rec.content.innerHTML = '';
      rec.content.appendChild(h('div', { class: 'atlas-empty', role: 'alert' }, [icon('alert'), ' ', err.message]));
    }
    if (!rec._chartUsed && rec.chart) {
      rec.chart.dispose(); rec.chart = null; rec.chartEl = null;
      if (rec.ro) { rec.ro.disconnect(); rec.ro = null; }
    }
    if (rec.showTable) this.applyView(rec);
  };

  /* ================================================================== */
  /* VisualContext — the API every visual renderer receives              */
  /* ================================================================== */

  function VisualContext(dash, rec, tokens) {
    this.dashboard = dash;
    this.record = rec;
    this.config = rec.config;
    this.id = rec.id;
    this.el = rec.content;
    this.state = rec.state;
    this.theme = tokens;
    this.rows = applyVisualFilter(dash.filteredRows(rec.id), rec.config.filter);
    this.allRows = dash.rows;
    this.selection = dash.cross && dash.cross.source === rec.id ? dash.cross : null;
  }
  var VC = VisualContext.prototype;

  /** Visual-level filter: { "status": "Escalated" } or { "region": ["Europe", "Asia Pacific"] }. */
  function applyVisualFilter(rows, filter) {
    if (!filter) return rows;
    var keys = Object.keys(filter);
    return rows.filter(function (r) {
      return keys.every(function (k) {
        var want = filter[k];
        var v = keyOf(r[k]);
        return Array.isArray(want) ? want.map(String).indexOf(v) >= 0 : v === String(want);
      });
    });
  }

  VC.fmt = function (value, fmt) { return this.dashboard.format(value, fmt); };
  VC.field = function (name) { return this.dashboard.field(name); };
  VC.label = function (name) { return this.dashboard.label(name); };
  VC.colorFor = function (field, value) { return this.dashboard.colorFor(field, value, this.theme); };

  /** Throw a readable error if the config references fields that aren't in the data. */
  VC.checkFields = function () {
    var c = this.config, dash = this.dashboard, missing = [];
    if (!dash.rows.length) return;
    function check(f) {
      if (f == null) return;
      if (Array.isArray(f)) return f.forEach(check);
      if (typeof f === 'object') return check(f.field);
      if (typeof f === 'string' && dash.field(f).missing) missing.push(f);
    }
    if (c.filter) check(Object.keys(c.filter));
    ['category', 'series', 'x', 'y', 'size', 'details', 'source', 'target', 'trend', 'rows', 'columns', 'levels', 'value', 'values', 'lines', 'groupBy'].forEach(function (k) {
      if (k === 'columns' && c.type === 'table') return;
      if (k === 'target' && typeof c.target !== 'string') return;
      check(c[k]);
    });
    if (c.type === 'table' && Array.isArray(c.columns)) check(c.columns);
    if (missing.length) {
      throw new Error('Field' + (missing.length > 1 ? 's' : '') + ' not found in data: ' + missing.join(', ') +
        '. Available: ' + dash.fieldOrder.join(', '));
    }
  };

  /** Normalise a measure spec: "revenue" | {field, agg, label, format}. */
  VC.measure = function (m, defaultAgg) {
    if (m == null || m === '') return { field: null, agg: 'count', label: 'Count', format: 'integer', id: 'count' };
    if (typeof m === 'string') m = { field: m };
    var meta = this.field(m.field);
    var agg = m.agg || defaultAgg || this.config.agg || (meta.type === 'number' ? 'sum' : 'count');
    var isCount = agg === 'count' || agg === 'distinct' || agg === 'countDistinct';
    return {
      field: m.field, agg: agg,
      label: m.label || (isCount && meta.type !== 'number' ? (agg === 'count' ? 'Count of ' : 'Distinct ') + meta.label : meta.label),
      format: m.format || this.config.format || (isCount ? 'integer' : meta.format),
      id: m.field + ':' + agg
    };
  };
  VC.measures = function (key) {
    var c = this.config, self = this;
    var list = key ? c[key] : c.values != null ? c.values : c.value != null ? c.value : null;
    if (list == null) return key ? [] : [this.measure(null)];
    if (!Array.isArray(list)) list = [list];
    return list.map(function (m) { return self.measure(m); });
  };
  /** Aggregate a set of rows for one measure. */
  VC.aggregate = function (rows, m) {
    var fn = AGGREGATES[m.agg];
    if (!fn) throw new Error('Unknown aggregation "' + m.agg + '". Use sum, avg, min, max, median, count or distinct.');
    if (!m.field) return rows.length;
    return fn(rows.map(function (r) { return r[m.field]; }));
  };

  /** A grouping dimension: plain field, or date field bucketed by grain. */
  VC.dimension = function (field, grain) {
    var meta = this.field(field);
    var g = grain || (meta.type === 'date' ? (this.config.grain || 'month') : null);
    return {
      field: field, grain: g, meta: meta, isDate: meta.type === 'date',
      key: g ? function (r) { return grainKey(r[field], g); } : function (r) { return keyOf(r[field]); },
      label: g ? function (k) { return grainLabel(k, g); } : function (k) { return k; }
    };
  };

  /**
   * The workhorse for category charts. Groups rows by category (and optional
   * series field), aggregates measures, sorts, folds the tail into "Other".
   * Returns { dim, keys, labels, series:[{name, key, color, values, measure}], measures }.
   */
  VC.categorize = function (opts) {
    opts = opts || {};
    var self = this, c = this.config;
    var dim = this.dimension(opts.category || c.category, opts.grain || c.grain);
    var measures = opts.measures || this.measures();
    var rows = opts.rows || this.rows;
    var seriesField = opts.series !== undefined ? opts.series : c.series;
    var sortMode = opts.sort || c.sort || (dim.isDate ? 'category' : 'desc');
    var top = opts.top != null ? opts.top : c.top;

    var keyFn = dim.key;
    // Rank categories by the first measure so we can sort and fold the tail.
    var groups = groupBy(rows, keyFn);
    var keys = Array.from(groups.keys());
    var totals = new Map();
    keys.forEach(function (k) { totals.set(k, self.aggregate(groups.get(k), measures[0]) || 0); });
    if (sortMode === 'desc') keys.sort(function (a, b) { return totals.get(b) - totals.get(a); });
    else if (sortMode === 'asc') keys.sort(function (a, b) { return totals.get(a) - totals.get(b); });
    else if (sortMode === 'category' || sortMode === 'alpha') keys.sort(function (a, b) { return String(a).localeCompare(String(b), undefined, { numeric: true }); });
    else if (Array.isArray(sortMode)) keys.sort(function (a, b) { return idx(sortMode, a) - idx(sortMode, b); });

    if (top && keys.length > top) {
      var keep = new Set(keys.slice(0, top));
      keyFn = function (r) { var k = dim.key(r); return keep.has(k) ? k : OTHER; };
      groups = groupBy(rows, keyFn);
      keys = keys.slice(0, top).concat([OTHER]);
    }

    var series = [];
    if (seriesField) {
      var m = measures[0];
      var sdim = this.dimension(seriesField);
      var sGroups = groupBy(rows, sdim.key);
      var sKeys = Array.from(sGroups.keys());
      var sTotals = new Map();
      sKeys.forEach(function (k) { sTotals.set(k, self.aggregate(sGroups.get(k), m) || 0); });
      sKeys.sort(function (a, b) { return sdim.isDate ? String(a).localeCompare(String(b)) : sTotals.get(b) - sTotals.get(a); });
      var maxSeries = c.maxSeries || 8;
      var sKeyFn = sdim.key;
      if (sKeys.length > maxSeries) {
        var keepS = new Set(sKeys.slice(0, maxSeries - 1));
        sKeyFn = function (r) { var k = sdim.key(r); return keepS.has(k) ? k : OTHER; };
        sKeys = sKeys.slice(0, maxSeries - 1).concat([OTHER]);
      }
      sKeys.forEach(function (sk, si) {
        series.push({
          name: sdim.label(sk), key: sk, measure: m,
          color: sdim.isDate ? self.theme.palette[si % 8] : self.colorFor(seriesField, sk),
          values: keys.map(function (k) {
            var bucket = (groups.get(k) || []).filter(function (r) { return sKeyFn(r) === sk; });
            return bucket.length ? self.aggregate(bucket, m) : null;
          })
        });
      });
    } else {
      measures.forEach(function (m, mi) {
        series.push({
          name: m.label, key: m.id, measure: m, color: self.theme.palette[mi % 8],
          values: keys.map(function (k) { return self.aggregate(groups.get(k) || [], m); })
        });
      });
    }
    return {
      dim: dim, keys: keys, labels: keys.map(dim.label), series: series, measures: measures, seriesField: seriesField
    };
  };
  function idx(arr, v) { var i = arr.indexOf(v); return i < 0 ? arr.length : i; }

  /** Build a tree of {name, value, children} from a list of level fields. */
  VC.hierarchy = function (levels, m, rows) {
    var self = this;
    rows = rows || this.rows;
    function build(rs, depth, path) {
      var dim = self.dimension(levels[depth]);
      var groups = groupBy(rs, dim.key);
      var nodes = [];
      groups.forEach(function (bucket, k) {
        var node = { name: dim.label(k), key: k, field: levels[depth], depth: depth, path: path.concat([k]), value: self.aggregate(bucket, m) };
        if (depth < levels.length - 1) node.children = build(bucket, depth + 1, node.path);
        nodes.push(node);
      });
      nodes.sort(function (a, b) { return (b.value || 0) - (a.value || 0); });
      return nodes;
    }
    return build(rows, 0, []);
  };

  /** Register the data table behind this visual (used by "Show data table" and CSV download). */
  VC.setTable = function (columns, rows) {
    columns = columns.map(function (c, i) { return typeof c === 'string' ? { key: c, label: c, index: i } : Object.assign({ index: i }, c); });
    this.record.table = { columns: columns, rows: rows };
  };

  /** Click on a category: drill-through if configured, else toggle a cross-filter. */
  VC.select = function (field, key, grain) {
    if (key == null || key === OTHER) return;
    var dt = this.config.drillThrough;
    if (dt) return this.dashboard.drillThrough(dt, field, key, grain);
    if (this.config.crossFilter === false || this.dashboard.config.crossFilter === false) return;
    this.dashboard.setCrossFilter(field, key, grain, this.id);
  };
  VC.isDimmed = function (field, key) {
    var s = this.selection;
    return !!(s && s.field === field && s.value !== key);
  };

  VC.empty = function (message) {
    this.el.innerHTML = '';
    this.el.appendChild(h('div', { class: 'atlas-empty', text: message || 'No data for the current filters' }));
  };
  VC.rerender = function () { this.dashboard.renderVisual(this.record); };

  /** Create or update this visual's ECharts instance. Base styling is merged in. */
  VC.chart = function (option, opts) {
    opts = opts || {};
    var rec = this.record, ec = global.echarts;
    if (!ec) throw new Error('ECharts is not loaded. Add <script src="vendor/echarts/echarts.min.js"></script> before atlas.js.');
    if (!rec.chartEl) {
      rec.chartEl = h('div', { class: 'atlas-chart', role: 'img' });
    }
    rec.chartEl.style.height = (opts.height || this.config.height || null) ? toPx(opts.height || this.config.height) : '';
    rec.chartEl.setAttribute('aria-label', (this.config.title || this.config.type) + ' chart. Use the table button for the underlying data.');
    this.el.appendChild(rec.chartEl);
    if (!rec.chart) {
      rec.chart = ec.init(rec.chartEl, null, { renderer: this.dashboard.config.renderer || 'canvas' });
      if (global.ResizeObserver) {
        rec.ro = new ResizeObserver(function () { if (rec.chart) rec.chart.resize(); });
        rec.ro.observe(rec.chartEl);
      }
    }
    rec._chartUsed = true;
    rec.chart.off('click');
    rec.chart.setOption(Object.assign(this.baseOption(), option), { notMerge: true });
    rec.chart.resize();
    return rec.chart;
  };
  function toPx(v) { return typeof v === 'number' ? v + 'px' : v; }
  function prefersReducedMotion() {
    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  VC.baseOption = function () {
    var t = this.theme;
    return {
      color: t.palette,
      backgroundColor: 'transparent',
      textStyle: { fontFamily: t.font, color: t.ink2 },
      // Viewers who ask their system for less motion get charts that appear without animating.
      animation: !prefersReducedMotion(),
      animationDuration: 350,
      tooltip: {
        backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, padding: [8, 10],
        textStyle: { color: t.ink, fontSize: 12 }, confine: true,
        extraCssText: 'box-shadow:0 6px 20px rgba(0,0,0,.15);border-radius:6px;'
      }
    };
  };
  VC.legend = function (show) {
    var t = this.theme;
    return {
      show: !!show, type: 'scroll', top: 0, left: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, itemGap: 14,
      textStyle: { color: t.ink2, fontSize: 12 }, pageTextStyle: { color: t.ink2 },
      pageIconColor: t.ink2, pageIconInactiveColor: t.muted
    };
  };
  VC.categoryAxis = function (labels, extra) {
    var t = this.theme;
    return Object.assign({
      type: 'category', data: labels,
      axisLine: { lineStyle: { color: t.axis } }, axisTick: { show: false },
      axisLabel: { color: t.muted, fontSize: 11, hideOverlap: true }
    }, extra);
  };
  VC.valueAxis = function (fmt, extra) {
    var t = this.theme, self = this, af = axisFormat(fmt);
    return Object.assign({
      type: 'value',
      splitLine: { lineStyle: { color: t.grid } },
      axisLabel: { color: t.muted, fontSize: 11, formatter: function (v) { return self.fmt(v, af); } }
    }, extra);
  };

  /* ================================================================== */
  /* Shared HTML table renderer (table visual, matrix, data view)        */
  /* ================================================================== */

  function renderTable(dash, table, opts) {
    opts = opts || {};
    var cols = table.columns, rows = table.rows.slice();
    var sortState = opts.sortState || {};
    var limit = opts.limit || 500;
    var wrap = h('div', { class: 'atlas-table-wrap' });
    function cellVal(r, c) { return Array.isArray(r) ? r[c.index] : r[c.key]; }
    function draw() {
      wrap.innerHTML = '';
      var data = rows.slice();
      if (sortState.key != null) {
        var col = cols.filter(function (c) { return c.key === sortState.key; })[0];
        data.sort(function (a, b) {
          var x = cellVal(a, col), y = cellVal(b, col);
          if (x == null) return 1; if (y == null) return -1;
          var r = x < y ? -1 : x > y ? 1 : 0;
          return sortState.dir === 'desc' ? -r : r;
        });
      }
      var maxes = {};
      (opts.dataBars || []).forEach(function (k) {
        var col = cols.filter(function (c) { return c.key === k; })[0];
        if (col) maxes[k] = Math.max.apply(null, data.map(function (r) { return Math.abs(cellVal(r, col)) || 0; }).concat([0]));
      });
      var thead = h('thead', null, h('tr', null, cols.map(function (c) {
        var th = h('th', {
          scope: 'col', class: c.numeric ? 'num' : null, 'data-sort': opts.sortable === false ? null : c.key,
          'aria-sort': sortState.key === c.key ? (sortState.dir === 'desc' ? 'descending' : 'ascending') : null, text: c.label
        });
        if (opts.sortable !== false) {
          th.tabIndex = 0;
          var go = function () {
            sortState.dir = sortState.key === c.key && sortState.dir === 'desc' ? 'asc' : 'desc';
            sortState.key = c.key;
            draw();
          };
          th.addEventListener('click', go);
          th.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
        }
        return th;
      })));
      var tbody = h('tbody', null, data.slice(0, limit).map(function (r) {
        return h('tr', { class: r._total ? 'atlas-total' : null }, cols.map(function (c, ci) {
          var v = cellVal(r, c);
          var td = h(ci === 0 && opts.rowHeaders ? 'th' : 'td', { class: c.numeric ? 'num' : null, scope: ci === 0 && opts.rowHeaders ? 'row' : null });
          if (maxes[c.key] && typeof v === 'number') {
            td.classList.add('atlas-databar');
            td.appendChild(h('span', { style: { width: (Math.abs(v) / maxes[c.key] * 100).toFixed(1) + '%' }, 'aria-hidden': 'true' }));
          }
          td.appendChild(document.createTextNode(c.format ? dash.format(v, c.format) : v == null ? '–' : (v instanceof Date ? dash.format(v, 'date') : String(v))));
          return td;
        }));
      }));
      var table = h('table', { class: 'atlas-table' }, [thead, tbody]);
      if (opts.footer) {
        var f = opts.footer;
        table.appendChild(h('tfoot', null, h('tr', null, cols.map(function (c) {
          var v = cellVal(f, c);
          return h('td', { class: c.numeric ? 'num' : null, text: v == null ? '' : c.format ? dash.format(v, c.format) : String(v) });
        }))));
      }
      wrap.appendChild(table);
      if (data.length > limit) wrap.appendChild(h('div', { class: 'atlas-table__note', text: 'Showing ' + limit + ' of ' + data.length.toLocaleString() + ' rows. Download CSV for all rows.' }));
    }
    draw();
    return wrap;
  }

  /* ================================================================== */
  /* Public API                                                          */
  /* ================================================================== */

  var Atlas = {
    version: VERSION,
    /** Make a data set available to dashboards by name: Atlas.registerData('sales', rows). */
    registerData: function (name, rows) {
      // Accept row objects, or the compact columnar form { columns: [...], rows: [[...], ...] }.
      if (rows && !Array.isArray(rows) && Array.isArray(rows.columns) && Array.isArray(rows.rows)) {
        var cols = rows.columns;
        rows = rows.rows.map(function (r) { var o = {}; cols.forEach(function (c, i) { o[c] = r[i]; }); return o; });
      }
      datasets[name] = rows;
      return rows;
    },
    getData: function (name) { return datasets[name]; },
    /** Build a dashboard from a config object. Returns the Dashboard instance. */
    dashboard: function (config, mount) {
      var d = new Dashboard(config, typeof mount === 'string' ? document.querySelector(mount) : mount);
      Atlas.instances.push(d);
      return d;
    },
    /**
     * Register a visual type.  render(ctx, preset) draws into ctx.el.
     * meta: { chart: true if it uses ctx.chart(), span: default grid span }
     */
    registerVisual: function (type, render, meta, preset) {
      visualTypes[type] = { render: render, meta: meta || {}, preset: preset };
    },
    visualTypes: function () { return Object.keys(visualTypes).sort(); },
    registerFormat: function (name, fn) { customFormats[name] = fn; },
    instances: [],
    util: {
      h: h, icon: icon, button: button, escapeHtml: escapeHtml, parseCSV: parseCSV, toCSV: toCSV,
      parseDate: parseDate, isoDate: isoDate, grainKey: grainKey, grainLabel: grainLabel, humanize: humanize,
      groupBy: groupBy, aggregates: AGGREGATES, renderTable: renderTable, themeTokens: themeTokens,
      downloadFile: downloadFile, toast: toast, OTHER: OTHER, BLANK: BLANK
    }
  };
  global.Atlas = Atlas;

  // Restore the viewer's last theme choice before first paint of charts.
  try {
    var saved = localStorage.getItem('atlas-theme');
    if (saved === 'dark' || saved === 'light') document.documentElement.setAttribute('data-theme', saved);
  } catch (e) { /* storage unavailable */ }

  /** Auto-boot every <script type="application/json" data-atlas> block on the page. */
  function boot() {
    document.querySelectorAll('script[type="application/json"][data-atlas]').forEach(function (s) {
      var cfg;
      try { cfg = JSON.parse(s.textContent); } catch (err) {
        console.error('[Atlas] Config JSON is invalid:', err);
        document.body.appendChild(h('pre', { class: 'atlas-empty', role: 'alert', text: 'Atlas config JSON is invalid: ' + err.message }));
        return;
      }
      var target = s.getAttribute('data-atlas') ? document.querySelector(s.getAttribute('data-atlas')) : null;
      Atlas.dashboard(cfg, target);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);
})(window);
