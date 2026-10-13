/*!
 * Atlas HTML Charts — visual library
 * Every visual is registered with Atlas.registerVisual(type, render, meta, preset).
 * Power BI names are registered as aliases so a report can be ported 1:1
 * (see docs/powerbi-mapping.md). To add your own visual, copy any block below.
 */
(function (Atlas) {
  'use strict';
  if (!Atlas) throw new Error('Load atlas.js before visuals.js');

  var u = Atlas.util, h = u.h, OTHER = u.OTHER;

  function toArray(v) { return v == null ? [] : Array.isArray(v) ? v : [v]; }

  function hexToRgb(hex) {
    hex = String(hex).trim().replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  /** Blend two hex colours. t = 0 -> a, t = 1 -> b. */
  function mix(a, b, t) {
    var x = hexToRgb(a), y = hexToRgb(b);
    return '#' + x.map(function (v, i) {
      return Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0');
    }).join('');
  }
  /** Round up to a "nice" axis maximum (1, 2, 2.5, 5, 10 × 10^n). */
  function niceMax(v) {
    if (!v || v <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v)));
    var steps = [1, 2, 2.5, 5, 10];
    for (var i = 0; i < steps.length; i++) if (steps[i] * p >= v) return steps[i] * p;
    return 10 * p;
  }
  /** Values for `keys`, where "Other" collects every row whose key is not in keys. */
  function valuesFor(ctx, keys, dim, m) {
    var named = new Set(keys.filter(function (k) { return k !== OTHER; }));
    var groups = u.groupBy(ctx.rows, function (r) { var k = dim.key(r); return named.has(k) ? k : OTHER; });
    return keys.map(function (k) { return groups.has(k) ? ctx.aggregate(groups.get(k), m) : null; });
  }
  function categoryTable(ctx, d, fmt, valuesOverride) {
    var cols = [{ key: 'category', label: d.dim.meta.label }].concat(d.series.map(function (s, i) {
      return { key: 's' + i, label: s.name, format: fmt || s.measure.format, numeric: true };
    }));
    var rows = d.keys.map(function (k, i) {
      var r = { category: d.labels[i] };
      d.series.forEach(function (s, si) { r['s' + si] = (valuesOverride ? valuesOverride[si] : s.values)[i]; });
      return r;
    });
    ctx.setTable(cols, rows);
  }
  function directLabel(ctx, fmt, position) {
    return { show: true, position: position, color: ctx.theme.ink2, fontSize: 11, formatter: function (p) { return ctx.fmt(p.value, fmt); } };
  }

  /* ================================================================== */
  /* Bar / column / line / area (clustered, stacked, 100% stacked)       */
  /* ================================================================== */

  function cartesian(ctx, p) {
    var c = ctx.config, t = ctx.theme;
    var d = ctx.categorize();
    if (!d.keys.length) return ctx.empty();
    var percent = p.percent || c.stack === 'percent';
    var stack = percent || p.stack || c.stack === true;
    var isLine = p.kind === 'line';
    var fmt = percent ? 'percent' : d.series[0].measure.format;
    var values = d.series.map(function (s) { return s.values; });
    if (percent) {
      var totals = d.keys.map(function (_, i) {
        return values.reduce(function (sum, vals) { return sum + (Math.abs(vals[i]) || 0); }, 0);
      });
      values = values.map(function (vals) { return vals.map(function (v, i) { return totals[i] ? (v || 0) / totals[i] : null; }); });
    }
    var multi = d.series.length > 1;
    var series = d.series.map(function (s, si) {
      var o = {
        name: s.name, type: isLine ? 'line' : 'bar',
        data: values[si].map(function (v, i) {
          return ctx.isDimmed(d.dim.field, d.keys[i]) ? { value: v, itemStyle: { opacity: 0.3 } } : v;
        }),
        itemStyle: { color: s.color },
        emphasis: { focus: multi ? 'series' : 'none' }
      };
      if (stack) o.stack = 'total';
      if (isLine) {
        o.lineStyle = { width: 2 };
        o.symbol = 'circle';
        o.symbolSize = 7;
        o.showSymbol = d.keys.length <= 24;
        o.smooth = !!c.smooth;
        o.connectNulls = true;
        if (p.area) o.areaStyle = { opacity: stack ? 0.85 : 0.16 };
      } else {
        o.barMaxWidth = 40;
        o.itemStyle.borderRadius = stack ? 0 : (p.horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]);
        if (stack) { o.itemStyle.borderColor = t.surface; o.itemStyle.borderWidth = 1; }
      }
      if (c.labels) o.label = directLabel(ctx, fmt, stack ? 'inside' : (p.horizontal ? 'right' : 'top'));
      return o;
    });
    var catAxis = ctx.categoryAxis(d.labels, p.horizontal
      ? { inverse: true, axisLabel: { color: t.muted, fontSize: 11, width: 130, overflow: 'truncate' } }
      : { boundaryGap: !isLine });
    var valAxis = ctx.valueAxis(fmt, percent ? { max: 1 } : {});
    var chart = ctx.chart({
      legend: ctx.legend(multi),
      grid: { left: 4, right: c.labels && p.horizontal ? 48 : 16, top: multi ? 36 : 12, bottom: 4, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: isLine ? 'line' : 'shadow' }, valueFormatter: function (v) { return ctx.fmt(v, fmt); } },
      xAxis: p.horizontal ? valAxis : catAxis,
      yAxis: p.horizontal ? catAxis : valAxis,
      series: series
    });
    chart.on('click', function (e) { ctx.select(d.dim.field, d.keys[e.dataIndex], d.dim.grain); });
    categoryTable(ctx, d, fmt, values);
  }

  var CARTESIAN = {
    // Power BI: Clustered / stacked / 100% stacked bar (horizontal)
    bar: { kind: 'bar', horizontal: true },
    clusteredBar: { kind: 'bar', horizontal: true },
    stackedBar: { kind: 'bar', horizontal: true, stack: true },
    stackedBar100: { kind: 'bar', horizontal: true, percent: true },
    // Power BI: Clustered / stacked / 100% stacked column (vertical)
    column: { kind: 'bar' },
    clusteredColumn: { kind: 'bar' },
    stackedColumn: { kind: 'bar', stack: true },
    stackedColumn100: { kind: 'bar', percent: true },
    // Power BI: Line, Area, Stacked area, 100% stacked area
    line: { kind: 'line' },
    area: { kind: 'line', area: true },
    stackedArea: { kind: 'line', area: true, stack: true },
    stackedArea100: { kind: 'line', area: true, percent: true }
  };
  Object.keys(CARTESIAN).forEach(function (type) {
    Atlas.registerVisual(type, cartesian, { chart: true }, CARTESIAN[type]);
  });

  /* ---------------- Line + column combo (single shared value axis) ---------------- */
  // Power BI: "Line and clustered column" / "Line and stacked column".
  // Atlas deliberately keeps ONE value axis: dual axes invite false comparisons.
  // If the line measure is on a different scale, put it in its own chart.
  function combo(ctx, p) {
    var c = ctx.config, t = ctx.theme;
    var colMeasures = ctx.measures(c.columns ? 'columns' : null);
    var lineMeasures = ctx.measures('lines');
    var d = ctx.categorize({ measures: colMeasures });
    if (!d.keys.length) return ctx.empty();
    var fmt = colMeasures[0].format;
    var stack = p.stack || c.stack === true;
    var series = d.series.map(function (s) {
      return {
        name: s.name, type: 'bar', data: s.values, stack: stack ? 'cols' : undefined, barMaxWidth: 40,
        itemStyle: { color: s.color, borderRadius: stack ? 0 : [4, 4, 0, 0], borderColor: t.surface, borderWidth: stack ? 1 : 0 }
      };
    });
    var firstLine = d.series.length;
    lineMeasures.forEach(function (m, i) {
      var color = t.palette[(firstLine + i) % 8];
      var vals = valuesFor(ctx, d.keys, d.dim, m);
      d.series.push({ name: m.label, measure: m, values: vals, color: color });
      series.push({
        name: m.label, type: 'line', data: vals, symbol: 'circle', symbolSize: 7, z: 3,
        lineStyle: { width: 2, color: color }, itemStyle: { color: color, borderColor: t.surface, borderWidth: 2 }
      });
    });
    var chart = ctx.chart({
      legend: ctx.legend(series.length > 1),
      grid: { left: 4, right: 16, top: series.length > 1 ? 36 : 12, bottom: 4, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: function (v) { return ctx.fmt(v, fmt); } },
      xAxis: ctx.categoryAxis(d.labels),
      yAxis: ctx.valueAxis(fmt),
      series: series
    });
    chart.on('click', function (e) { ctx.select(d.dim.field, d.keys[e.dataIndex], d.dim.grain); });
    categoryTable(ctx, d);
  }
  Atlas.registerVisual('combo', combo, { chart: true });
  Atlas.registerVisual('lineClusteredColumn', combo, { chart: true });
  Atlas.registerVisual('lineStackedColumn', combo, { chart: true }, { stack: true });

  /* ---------------- Waterfall ---------------- */
  function waterfall(ctx) {
    var c = ctx.config, t = ctx.theme;
    var d = ctx.categorize({ series: null, sort: c.sort || (ctx.dimension(c.category).isDate ? 'category' : 'none') });
    if (!d.keys.length) return ctx.empty();
    var m = d.series[0].measure, vals = d.series[0].values;
    var base = [], up = [], down = [], total = [], running = 0, labels = d.labels.slice();
    vals.forEach(function (v) {
      v = v || 0;
      if (v >= 0) { base.push(running); up.push(v); down.push('-'); running += v; }
      else { running += v; base.push(running); down.push(-v); up.push('-'); }
      total.push('-');
    });
    if (c.total !== false) {
      labels.push(c.totalLabel || 'Total');
      base.push(0); up.push('-'); down.push('-'); total.push(running);
    }
    var bar = function (name, data, color) {
      return { name: name, type: 'bar', stack: 'wf', data: data, barMaxWidth: 48, itemStyle: { color: color, borderRadius: 3 } };
    };
    var chart = ctx.chart({
      legend: ctx.legend(true),
      grid: { left: 4, right: 16, top: 36, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: function (ps) {
          var i = ps[0].dataIndex;
          var isTotal = c.total !== false && i === labels.length - 1;
          var v = isTotal ? running : vals[i];
          return u.escapeHtml(labels[i]) + '<br><b>' + (isTotal ? '' : v >= 0 ? '+' : '') + u.escapeHtml(ctx.fmt(v, m.format)) + '</b>';
        }
      },
      xAxis: ctx.categoryAxis(labels),
      yAxis: ctx.valueAxis(m.format),
      series: [
        { name: 'base', type: 'bar', stack: 'wf', data: base, itemStyle: { color: 'transparent' }, emphasis: { disabled: true }, silent: true, tooltip: { show: false } },
        bar(c.increaseLabel || 'Increase', up, t.palette[0]),
        bar(c.decreaseLabel || 'Decrease', down, t.palette[7]),
        bar(c.totalLabel || 'Total', total, t.ink2)
      ]
    });
    chart.setOption({ legend: { data: [c.increaseLabel || 'Increase', c.decreaseLabel || 'Decrease', c.totalLabel || 'Total'] } });
    chart.on('click', function (e) { if (e.dataIndex < d.keys.length) ctx.select(d.dim.field, d.keys[e.dataIndex], d.dim.grain); });
    categoryTable(ctx, d);
  }
  Atlas.registerVisual('waterfall', waterfall, { chart: true });

  /* ---------------- Funnel ---------------- */
  function funnel(ctx) {
    var c = ctx.config, t = ctx.theme;
    var d = ctx.categorize({ series: null, sort: c.order || c.sort || 'desc' });
    if (!d.keys.length) return ctx.empty();
    var m = d.series[0].measure, vals = d.series[0].values;
    // cumulative: rows record the FURTHEST stage reached, so stage i = everything at stage >= i.
    if (c.cumulative) {
      vals = vals.map(function (_, i) { return vals.slice(i).reduce(function (s, v) { return s + (v || 0); }, 0); });
      d.series[0].values = vals;
    }
    var first = vals[0] || 1;
    var n = d.keys.length;
    var data = d.keys.map(function (k, i) {
      return {
        name: d.labels[i], value: vals[i], key: k,
        itemStyle: { color: mix(t.seqHigh, t.seqMid, n > 1 ? i / (n - 1) : 0), opacity: ctx.isDimmed(d.dim.field, k) ? 0.3 : 1, borderColor: t.surface, borderWidth: 2 }
      };
    });
    var chart = ctx.chart({
      tooltip: {
        trigger: 'item',
        formatter: function (p) {
          return u.escapeHtml(p.name) + '<br><b>' + u.escapeHtml(ctx.fmt(p.value, m.format)) + '</b> · ' + ctx.fmt(p.value / first, 'percent') + ' of first stage';
        }
      },
      series: [{
        type: 'funnel', left: 8, right: '38%', top: 8, bottom: 8, minSize: '8%', gap: 2,
        sort: c.order || c.sort === 'none' ? 'none' : 'descending', data: data,
        label: {
          position: 'right', color: t.ink2, fontSize: 12,
          formatter: function (p) { return p.name + '  ' + ctx.fmt(p.value, m.format) + ' (' + ctx.fmt(p.value / first, 'percent') + ')'; }
        },
        labelLine: { lineStyle: { color: t.axis } }
      }]
    });
    chart.on('click', function (e) { ctx.select(d.dim.field, e.data.key, d.dim.grain); });
    categoryTable(ctx, d);
  }
  Atlas.registerVisual('funnel', funnel, { chart: true });

  /* ================================================================== */
  /* Pie, donut and drill-down / drill-through pie                       */
  /* ================================================================== */

  function pieOption(ctx, d, opts) {
    var c = ctx.config, t = ctx.theme, m = d.series[0].measure;
    var donut = opts.donut;
    var total = d.series[0].values.reduce(function (s, v) { return s + (v || 0); }, 0);
    var data = d.keys.map(function (k, i) {
      return {
        name: d.labels[i], value: d.series[0].values[i], key: k,
        itemStyle: { color: ctx.colorFor(d.dim.field, k), opacity: ctx.isDimmed(d.dim.field, k) ? 0.3 : 1, borderColor: t.surface, borderWidth: 2 }
      };
    });
    var center = ['50%', '56%'];
    var radius = donut ? ['48%', '72%'] : [0, '72%'];
    var series = [{
      type: 'pie', radius: radius, center: center, data: data, avoidLabelOverlap: true, minShowLabelAngle: 8,
      label: { color: t.ink2, fontSize: 11, formatter: function (p) { return p.name + '\n' + p.percent.toFixed(0) + '%'; } },
      labelLine: { lineStyle: { color: t.axis }, length: 8, length2: 8 },
      emphasis: { scaleSize: 4 }
    }];
    if (donut) {
      series.push({
        type: 'pie', radius: [0, 0], center: center, silent: true, tooltip: { show: false },
        data: [{ value: 1, name: '' }], itemStyle: { color: 'transparent' }, labelLine: { show: false },
        label: {
          show: true, position: 'center',
          formatter: '{v|' + ctx.fmt(total, m.format === 'currency' ? 'compactCurrency' : m.format === 'percent' ? 'percent' : 'compact') + '}\n{l|' + m.label + '}',
          rich: { v: { fontSize: 20, fontWeight: 650, color: t.ink, lineHeight: 26 }, l: { fontSize: 11, color: t.ink2 } }
        }
      });
    }
    var legend = ctx.legend(c.legend !== false && d.keys.length > 1);
    legend.data = d.labels;
    return {
      legend: legend,
      tooltip: {
        trigger: 'item',
        formatter: function (p) { return u.escapeHtml(p.name) + '<br><b>' + u.escapeHtml(ctx.fmt(p.value, m.format)) + '</b> (' + p.percent.toFixed(1) + '%)'; }
      },
      series: series
    };
  }

  function pie(ctx, p) {
    var c = ctx.config;
    var d = ctx.categorize({ series: null, sort: 'desc', top: c.top || 7 });
    if (!d.keys.length) return ctx.empty();
    var chart = ctx.chart(pieOption(ctx, d, { donut: p.donut }));
    chart.on('click', function (e) { if (e.data && e.data.key != null) ctx.select(d.dim.field, e.data.key, d.dim.grain); });
    categoryTable(ctx, d);
  }
  Atlas.registerVisual('pie', pie, { chart: true, span: 4 }, {});
  Atlas.registerVisual('donut', pie, { chart: true, span: 4 }, { donut: true });

  /**
   * Drill-down pie / donut.
   *   levels: ["region", "country", "city"]  — click a slice to go one level deeper,
   *   use the breadcrumb to go back up. At the last level a click cross-filters
   *   (or, with drillThrough: {href}, opens another page filtered to the full path).
   */
  function drillPie(ctx, p) {
    var c = ctx.config, levels = toArray(c.levels || c.category);
    if (!levels.length) throw new Error('drillPie needs "levels": ["field1", "field2", ...]');
    var path = ctx.state.path = (ctx.state.path || []).slice(0, levels.length - 1);
    var dims = levels.map(function (f) { return ctx.dimension(f); });
    var rows = ctx.rows.filter(function (r) {
      for (var i = 0; i < path.length; i++) if (dims[i].key(r) !== path[i]) return false;
      return true;
    });
    var depth = path.length, field = levels[depth];

    var crumb = h('nav', { class: 'atlas-breadcrumb', 'aria-label': 'Drill path' });
    var go = function (n) { ctx.state.path = path.slice(0, n); ctx.rerender(); };
    crumb.appendChild(depth ? h('button', { type: 'button', text: c.rootLabel || 'All', onclick: function () { go(0); } }) : h('span', { 'aria-current': 'location', text: c.rootLabel || 'All' }));
    path.forEach(function (k, i) {
      crumb.appendChild(h('span', { 'aria-hidden': 'true', text: '›' }));
      var lbl = dims[i].label(k);
      crumb.appendChild(i === depth - 1 ? h('span', { 'aria-current': 'location', text: lbl }) : h('button', { type: 'button', text: lbl, onclick: function () { go(i + 1); } }));
    });
    crumb.appendChild(h('span', { class: 'atlas-sr-only', text: 'Showing ' + dims[depth].meta.label }));
    ctx.el.appendChild(crumb);

    var d = ctx.categorize({ category: field, rows: rows, series: null, sort: 'desc', top: c.top || 7 });
    if (!d.keys.length) return ctx.el.appendChild(h('div', { class: 'atlas-empty', text: 'No data for the current filters' }));
    var hint = depth < levels.length - 1 ? 'Click a slice to drill into ' + dims[depth + 1].meta.label : null;
    var chart = ctx.chart(pieOption(ctx, d, { donut: p.donut !== false && c.donut !== false }));
    if (hint) chart.getDom().title = hint;
    chart.on('click', function (e) {
      var key = e.data && e.data.key;
      if (key == null || key === OTHER) return;
      if (depth < levels.length - 1) { ctx.state.path = path.concat([key]); ctx.rerender(); return; }
      if (c.drillThrough) {
        var extra = path.map(function (k, i) { return { field: levels[i], value: k, grain: dims[i].grain }; });
        return ctx.dashboard.drillThrough(c.drillThrough, field, key, dims[depth].grain, extra);
      }
      ctx.select(field, key, dims[depth].grain);
    });
    categoryTable(ctx, d);
  }
  Atlas.registerVisual('drillPie', drillPie, { chart: true, span: 4 }, { donut: false });
  Atlas.registerVisual('drillDonut', drillPie, { chart: true, span: 4 }, {});

  /* ================================================================== */
  /* Hierarchies: treemap, sunburst, decomposition tree                  */
  /* ================================================================== */

  function colorTree(ctx, nodes, field) {
    nodes.forEach(function (n) { n.itemStyle = { color: ctx.colorFor(field, n.key) }; });
    return nodes;
  }

  function treemap(ctx) {
    var c = ctx.config, t = ctx.theme, levels = toArray(c.levels || c.category);
    var m = ctx.measures()[0];
    var tree = colorTree(ctx, ctx.hierarchy(levels, m), levels[0]);
    if (!tree.length) return ctx.empty();
    var chart = ctx.chart({
      tooltip: { formatter: function (p) { return u.escapeHtml(p.treePathInfo.slice(1).map(function (x) { return x.name; }).join(' › ')) + '<br><b>' + u.escapeHtml(ctx.fmt(p.value, m.format)) + '</b>'; } },
      series: [{
        type: 'treemap', name: c.rootLabel || 'All', data: tree, roam: false, left: 0, right: 0, top: 0, bottom: levels.length > 1 ? 28 : 0,
        leafDepth: levels.length > 1 ? 1 : null, nodeClick: levels.length > 1 ? 'zoomToNode' : false,
        breadcrumb: { show: levels.length > 1, bottom: 0, itemStyle: { color: t.surface2, borderColor: t.border, textStyle: { color: t.ink } }, emphasis: { itemStyle: { color: t.grid } } },
        label: { color: '#fff', fontSize: 12, formatter: function (p) { return p.name + '\n' + ctx.fmt(p.value, m.format === 'currency' ? 'compactCurrency' : 'compact'); } },
        upperLabel: { show: levels.length > 1, height: 22, color: '#fff' },
        itemStyle: { borderColor: t.surface, borderWidth: 2, gapWidth: 2, borderRadius: 4 },
        levels: [{ itemStyle: { borderColor: t.surface, borderWidth: 2, gapWidth: 2 } }, { colorSaturation: [0.35, 0.6], itemStyle: { borderColorSaturation: 0.7, gapWidth: 1, borderWidth: 1 } }]
      }]
    });
    if (levels.length === 1) chart.on('click', function (e) { if (e.data) ctx.select(levels[0], e.data.key); });
    ctx.setTable([{ key: 'path', label: levels.map(ctx.label.bind(ctx)).join(' › ') }, { key: 'value', label: m.label, format: m.format, numeric: true }], flatten(tree));
  }
  function flatten(nodes, prefix, out) {
    out = out || [];
    nodes.forEach(function (n) {
      var p = (prefix ? prefix + ' › ' : '') + n.name;
      if (n.children) flatten(n.children, p, out); else out.push({ path: p, value: n.value });
    });
    return out;
  }
  Atlas.registerVisual('treemap', treemap, { chart: true });

  function sunburst(ctx) {
    var c = ctx.config, t = ctx.theme, levels = toArray(c.levels || c.category);
    var m = ctx.measures()[0];
    var tree = colorTree(ctx, ctx.hierarchy(levels, m), levels[0]);
    if (!tree.length) return ctx.empty();
    ctx.chart({
      tooltip: { formatter: function (p) { return u.escapeHtml(p.treePathInfo.slice(1).map(function (x) { return x.name; }).join(' › ')) + '<br><b>' + u.escapeHtml(ctx.fmt(p.value, m.format)) + '</b>'; } },
      series: [{
        type: 'sunburst', data: tree, radius: ['12%', '95%'], sort: null, nodeClick: 'rootToNode',
        itemStyle: { borderColor: t.surface, borderWidth: 2 },
        label: { rotate: 'radial', color: t.ink, fontSize: 11, minAngle: 10 },
        // Inner ring: full colour + white text. Outer rings: lighter tints + ink text.
        levels: [{}, { label: { color: '#fff' } }, { itemStyle: { opacity: 0.7 } }, { itemStyle: { opacity: 0.55 } }]
      }]
    });
    ctx.setTable([{ key: 'path', label: levels.map(ctx.label.bind(ctx)).join(' › ') }, { key: 'value', label: m.label, format: m.format, numeric: true }], flatten(tree));
  }
  Atlas.registerVisual('sunburst', sunburst, { chart: true, span: 4 });

  /** Power BI "Decomposition tree": break a measure down level by level. Click a node to expand it. */
  function decompositionTree(ctx) {
    var c = ctx.config, t = ctx.theme, levels = toArray(c.levels);
    var m = ctx.measures()[0];
    var children = ctx.hierarchy(levels, m);
    if (!children.length) return ctx.empty();
    var total = ctx.aggregate(ctx.rows, m);
    var short = m.format === 'currency' ? 'compactCurrency' : m.format === 'percent' ? 'percent' : 'compact';
    var root = { name: c.rootLabel || m.label, value: total, children: children };
    ctx.chart({
      tooltip: { trigger: 'item', formatter: function (p) { return u.escapeHtml(p.name) + '<br><b>' + u.escapeHtml(ctx.fmt(p.value, m.format)) + '</b>'; } },
      series: [{
        type: 'tree', data: [root], orient: 'LR', top: 12, bottom: 12, left: 90, right: 140,
        initialTreeDepth: 1, expandAndCollapse: true, symbol: 'roundRect', symbolSize: [10, 10],
        itemStyle: { color: t.accent, borderColor: t.accent }, lineStyle: { color: t.axis, width: 1.5, curveness: 0.5 },
        label: {
          position: 'left', align: 'right', verticalAlign: 'middle', fontSize: 12,
          formatter: function (p) { return '{n|' + p.name + '}\n{v|' + ctx.fmt(p.value, short) + '}'; },
          rich: { n: { color: t.ink, fontSize: 12, lineHeight: 16 }, v: { color: t.ink2, fontSize: 11, align: 'right' } }
        },
        leaves: { label: { position: 'right', align: 'left' } },
        animationDurationUpdate: 300
      }]
    }, { height: c.height || 420 });
    ctx.setTable([{ key: 'path', label: levels.map(ctx.label.bind(ctx)).join(' › ') }, { key: 'value', label: m.label, format: m.format, numeric: true }], flatten(children));
  }
  Atlas.registerVisual('decompositionTree', decompositionTree, { chart: true, span: 12 });

  /* ================================================================== */
  /* Flow: Sankey                                                        */
  /* ================================================================== */
  /**
   * Two ways to describe flows:
   *   levels: ["channel", "stage", "outcome"]  — rows flow left -> right through the levels
   *   source: "from", target: "to"             — an edge list (must be acyclic)
   */
  function sankey(ctx) {
    var c = ctx.config, t = ctx.theme, m = ctx.measures()[0];
    var nodes = [], nodeIndex = new Map(), links = new Map(), owner = new Map();
    function node(level, field, key, color) {
      var id = level + '\u0000' + key;
      if (nodeIndex.has(id)) return nodes[nodeIndex.get(id)].name;
      var name = String(key);
      if (owner.has(name) && owner.get(name) !== level) name = name + ' (' + ctx.label(field) + ')';
      owner.set(name, level);
      nodeIndex.set(id, nodes.length);
      nodes.push({ name: name, field: field, key: key, depth: typeof level === 'number' ? level : undefined, itemStyle: { color: color, borderColor: color } });
      return name;
    }
    function link(a, b, v) {
      if (!v) return;
      var id = a + '\u0000' + b;
      links.set(id, { source: a, target: b, value: (links.has(id) ? links.get(id).value : 0) + v });
    }
    if (c.levels) {
      var levels = toArray(c.levels), dims = levels.map(function (f) { return ctx.dimension(f); });
      for (var i = 0; i < levels.length - 1; i++) {
        var groups = u.groupBy(ctx.rows, function (r) { return dims[i].key(r) + '\u0000' + dims[i + 1].key(r); });
        groups.forEach(function (bucket, k) {
          var parts = k.split('\u0000');
          var a = node(i, levels[i], parts[0], t.palette[i % 8]);
          var b = node(i + 1, levels[i + 1], parts[1], t.palette[(i + 1) % 8]);
          link(a, b, ctx.aggregate(bucket, m));
        });
      }
    } else if (c.source && c.target) {
      var sd = ctx.dimension(c.source), td = ctx.dimension(c.target);
      var g = u.groupBy(ctx.rows, function (r) { return sd.key(r) + '\u0000' + td.key(r); });
      g.forEach(function (bucket, k) {
        var parts = k.split('\u0000');
        var a = node('n', c.source, parts[0], t.palette[0]);
        var b = node('n', c.target, parts[1], t.palette[0]);
        link(a, b, ctx.aggregate(bucket, m));
      });
    } else throw new Error('sankey needs "levels": [...] or "source" + "target" fields');
    if (!links.size) return ctx.empty();
    var linkList = Array.from(links.values());
    var chart = ctx.chart({
      tooltip: {
        trigger: 'item',
        formatter: function (p) {
          if (p.dataType === 'edge') return u.escapeHtml(p.data.source) + ' → ' + u.escapeHtml(p.data.target) + '<br><b>' + u.escapeHtml(ctx.fmt(p.data.value, m.format)) + '</b>';
          return u.escapeHtml(p.name) + '<br><b>' + u.escapeHtml(ctx.fmt(p.value, m.format)) + '</b>';
        }
      },
      series: [{
        type: 'sankey', data: nodes, links: linkList, left: 8, right: 120, top: 8, bottom: 8,
        nodeWidth: 14, nodeGap: 10, nodeAlign: c.nodeAlign || 'justify', draggable: false,
        emphasis: { focus: 'adjacency' },
        lineStyle: { color: 'source', opacity: 0.32, curveness: 0.5 },
        itemStyle: { borderWidth: 0 },
        label: { color: t.ink, fontSize: 12 }
      }]
    }, { height: c.height || 380 });
    chart.on('click', function (e) { if (e.dataType === 'node' && e.data) ctx.select(e.data.field, e.data.key); });
    ctx.setTable([
      { key: 'source', label: 'From' }, { key: 'target', label: 'To' },
      { key: 'value', label: m.label, format: m.format, numeric: true }
    ], linkList);
  }
  Atlas.registerVisual('sankey', sankey, { chart: true, span: 12 });

  /* ================================================================== */
  /* Scatter / bubble, heatmap, gauge                                    */
  /* ================================================================== */

  function scatter(ctx) {
    var c = ctx.config, t = ctx.theme;
    var xm = ctx.measure(c.x), ym = ctx.measure(c.y), sm = c.size ? ctx.measure(c.size) : null;
    var points;
    if (c.details) {
      var dd = ctx.dimension(c.details);
      points = [];
      u.groupBy(ctx.rows, dd.key).forEach(function (bucket, k) {
        points.push({
          key: k, name: dd.label(k), x: ctx.aggregate(bucket, xm), y: ctx.aggregate(bucket, ym),
          size: sm ? ctx.aggregate(bucket, sm) : null, group: c.series ? keyOf(bucket[0][c.series]) : null
        });
      });
    } else {
      points = ctx.rows.map(function (r, i) {
        return { key: i, name: '', x: r[c.x], y: r[c.y], size: sm ? r[c.size] : null, group: c.series ? keyOf(r[c.series]) : null };
      });
    }
    if (!points.length) return ctx.empty();
    var maxSize = sm ? Math.max.apply(null, points.map(function (p) { return Math.abs(p.size) || 0; })) || 1 : 1;
    var groups = new Map();
    var cap = c.maxSeries || 3;
    var ranked = c.series ? Array.from(u.groupBy(points, function (p) { return p.group; }).entries())
      .sort(function (a, b) { return b[1].length - a[1].length; }).map(function (e) { return e[0]; }) : [null];
    var keep = new Set(ranked.slice(0, ranked.length > cap ? cap - 1 : cap));
    points.forEach(function (p) {
      var g = c.series ? (keep.has(p.group) ? p.group : OTHER) : (xm.label + ' vs ' + ym.label);
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(p);
    });
    var series = Array.from(groups.entries()).map(function (e, i) {
      var color = c.series ? ctx.colorFor(c.series, e[0]) : t.palette[0];
      return {
        name: e[0], type: 'scatter',
        data: e[1].map(function (p) {
          return { value: [p.x, p.y, p.size], name: p.name, key: p.key, itemStyle: ctx.isDimmed(c.details, p.key) ? { opacity: 0.25 } : undefined };
        }),
        symbolSize: function (v) { return sm ? 8 + 32 * Math.sqrt(Math.abs(v[2] || 0) / maxSize) : 9; },
        itemStyle: { color: color, opacity: 0.85, borderColor: t.surface, borderWidth: 1.5 }
      };
    });
    var axisName = { nameLocation: 'middle', nameTextStyle: { color: t.ink2, fontSize: 11 } };
    var chart = ctx.chart({
      legend: ctx.legend(series.length > 1),
      grid: { left: 24, right: 20, top: series.length > 1 ? 40 : 16, bottom: 28, containLabel: true },
      tooltip: {
        trigger: 'item',
        formatter: function (p) {
          var v = p.value;
          return (p.name ? '<b>' + u.escapeHtml(p.name) + '</b><br>' : '') +
            u.escapeHtml(xm.label) + ': ' + u.escapeHtml(ctx.fmt(v[0], xm.format)) + '<br>' +
            u.escapeHtml(ym.label) + ': ' + u.escapeHtml(ctx.fmt(v[1], ym.format)) +
            (sm ? '<br>' + u.escapeHtml(sm.label) + ': ' + u.escapeHtml(ctx.fmt(v[2], sm.format)) : '');
        }
      },
      xAxis: ctx.valueAxis(xm.format, Object.assign({ name: xm.label, nameGap: 28, scale: true }, axisName)),
      yAxis: ctx.valueAxis(ym.format, Object.assign({ name: ym.label, nameGap: 48, scale: true }, axisName)),
      series: series
    });
    if (c.details) chart.on('click', function (e) { ctx.select(c.details, e.data.key); });
    var cols = [{ key: 'name', label: c.details ? ctx.label(c.details) : 'Row' }, { key: 'x', label: xm.label, format: xm.format, numeric: true }, { key: 'y', label: ym.label, format: ym.format, numeric: true }];
    if (sm) cols.push({ key: 'size', label: sm.label, format: sm.format, numeric: true });
    ctx.setTable(cols, points);
  }
  function keyOf(v) { return v instanceof Date ? u.isoDate(v) : v == null || v === '' ? u.BLANK : String(v); }
  Atlas.registerVisual('scatter', scatter, { chart: true });
  Atlas.registerVisual('bubble', scatter, { chart: true });

  function heatmap(ctx) {
    var c = ctx.config, t = ctx.theme, m = ctx.measures()[0];
    var xd = ctx.dimension(c.x || c.category), yd = ctx.dimension(c.y || c.series);
    var order = function (dim, explicit) {
      var keys = Array.from(u.groupBy(ctx.rows, dim.key).keys());
      if (explicit) return explicit.filter(function (k) { return keys.indexOf(k) >= 0; });
      return keys.sort(function (a, b) { return String(a).localeCompare(String(b), undefined, { numeric: true }); });
    };
    var xs = order(xd, c.xOrder), ys = order(yd, c.yOrder);
    if (!xs.length || !ys.length) return ctx.empty();
    var cells = u.groupBy(ctx.rows, function (r) { return xd.key(r) + '\u0000' + yd.key(r); });
    var data = [], min = Infinity, max = -Infinity, table = [];
    xs.forEach(function (x, xi) {
      ys.forEach(function (y, yi) {
        var b = cells.get(x + '\u0000' + y);
        var v = b ? ctx.aggregate(b, m) : null;
        if (v != null) { min = Math.min(min, v); max = Math.max(max, v); }
        data.push([xi, yi, v]);
        table.push({ x: xd.label(x), y: yd.label(y), value: v });
      });
    });
    var chart = ctx.chart({
      grid: { left: 4, right: 12, top: 8, bottom: 44, containLabel: true },
      tooltip: { formatter: function (p) { return u.escapeHtml(xd.label(xs[p.value[0]]) + ' · ' + yd.label(ys[p.value[1]])) + '<br><b>' + u.escapeHtml(ctx.fmt(p.value[2], m.format)) + '</b>'; } },
      xAxis: ctx.categoryAxis(xs.map(xd.label), { splitArea: { show: false } }),
      yAxis: ctx.categoryAxis(ys.map(yd.label), { inverse: true }),
      visualMap: {
        min: min === Infinity ? 0 : min, max: max === -Infinity ? 1 : max, calculable: false, orient: 'horizontal', left: 'center', bottom: 0,
        itemHeight: 160, itemWidth: 10, inRange: { color: [t.seqLow, t.seqMid, t.seqHigh] }, textStyle: { color: t.ink2, fontSize: 11 },
        formatter: function (v) { return ctx.fmt(v, m.format === 'currency' ? 'compactCurrency' : 'compact'); }
      },
      series: [{
        type: 'heatmap', data: data, itemStyle: { borderColor: t.surface, borderWidth: 2, borderRadius: 3 },
        label: { show: !!c.labels, fontSize: 10, formatter: function (p) { return ctx.fmt(p.value[2], 'compact'); } },
        emphasis: { itemStyle: { borderColor: t.ink, borderWidth: 1 } }
      }]
    });
    chart.on('click', function (e) { ctx.select(xd.field, xs[e.value[0]], xd.grain); });
    ctx.setTable([{ key: 'x', label: xd.meta.label }, { key: 'y', label: yd.meta.label }, { key: 'value', label: m.label, format: m.format, numeric: true }], table);
  }
  Atlas.registerVisual('heatmap', heatmap, { chart: true });

  function resolveNumber(ctx, spec) {
    if (spec == null) return null;
    if (typeof spec === 'number') return spec;
    return ctx.aggregate(ctx.rows, ctx.measure(spec));
  }

  function gauge(ctx) {
    var c = ctx.config, t = ctx.theme, m = ctx.measures()[0];
    var value = ctx.aggregate(ctx.rows, m);
    var target = resolveNumber(ctx, c.target);
    var min = c.min || 0;
    var max = c.max != null ? resolveNumber(ctx, c.max) : niceMax(Math.max(value || 0, target || 0) * 1.15);
    var common = { type: 'gauge', min: min, max: max, startAngle: 210, endAngle: -30, radius: '92%', center: ['50%', '58%'] };
    var series = [Object.assign({}, common, {
      progress: { show: true, width: 16, itemStyle: { color: t.palette[0] } },
      axisLine: { lineStyle: { width: 16, color: [[1, t.grid]] } },
      pointer: { show: false }, axisTick: { show: false }, splitLine: { show: false },
      axisLabel: { show: true, distance: -40, color: t.muted, fontSize: 10, formatter: function (v) { return v === min || v === max ? ctx.fmt(v, 'compact') : ''; } },
      splitNumber: 1,
      anchor: { show: false },
      title: { show: target != null, offsetCenter: [0, '32%'], color: t.ink2, fontSize: 12 },
      detail: { valueAnimation: true, offsetCenter: [0, '0%'], fontSize: 26, fontWeight: 650, color: t.ink, formatter: function (v) { return ctx.fmt(v, m.format); } },
      data: [{ value: value, name: target != null ? 'Target ' + ctx.fmt(target, m.format) : '' }]
    })];
    if (target != null) {
      series.push(Object.assign({}, common, {
        axisLine: { show: false }, progress: { show: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
        pointer: { show: true, icon: 'rect', length: '16%', width: 3, offsetCenter: [0, '-74%'], itemStyle: { color: t.ink } },
        anchor: { show: false }, title: { show: false }, detail: { show: false }, silent: true,
        data: [{ value: target }]
      }));
    }
    ctx.chart({ series: series }, { height: c.height || 240 });
    ctx.setTable([{ key: 'm', label: 'Measure' }, { key: 'v', label: 'Value', format: m.format, numeric: true }],
      [{ m: m.label, v: value }, { m: 'Target', v: target }, { m: 'Maximum', v: max }]);
  }
  Atlas.registerVisual('gauge', gauge, { chart: true, span: 3 });

  /* ================================================================== */
  /* HTML visuals: card, multi-row card, KPI, table, matrix, text        */
  /* ================================================================== */

  function card(ctx) {
    var c = ctx.config, m = ctx.measures()[0];
    var v = ctx.aggregate(ctx.rows, m);
    ctx.el.appendChild(h('div', { class: 'atlas-card' }, [
      h('div', { class: 'atlas-card__value', text: ctx.fmt(v, m.format) }),
      c.title ? (c.label ? h('div', { class: 'atlas-card__label', text: c.label }) : null) : h('div', { class: 'atlas-card__label', text: c.label || m.label })
    ]));
    ctx.setTable([{ key: 'm', label: 'Measure' }, { key: 'v', label: 'Value', format: m.format, numeric: true }], [{ m: m.label, v: v }]);
  }
  Atlas.registerVisual('card', card, { span: 3 });

  function multiRowCard(ctx) {
    var ms = ctx.measures();
    var rows = ms.map(function (m) { return { m: m.label, v: ctx.aggregate(ctx.rows, m), f: m.format }; });
    ctx.el.appendChild(h('div', { class: 'atlas-multirow' }, rows.map(function (r) {
      return h('div', null, [h('div', { class: 'atlas-card__value', text: ctx.fmt(r.v, r.f) }), h('div', { class: 'atlas-card__label', text: r.m })]);
    })));
    ctx.setTable([{ key: 'm', label: 'Measure' }, { key: 'v', label: 'Value', numeric: true }], rows.map(function (r) { return { m: r.m, v: ctx.fmt(r.v, r.f) }; }));
  }
  Atlas.registerVisual('multiRowCard', multiRowCard, { span: 6 });

  /** KPI: value vs target with status (icon + label, never colour alone) and an optional trend sparkline. */
  function kpi(ctx) {
    var c = ctx.config, t = ctx.theme, m = ctx.measures()[0];
    var v = ctx.aggregate(ctx.rows, m);
    var target = resolveNumber(ctx, c.target);
    var higher = c.higherIsBetter !== false;
    var box = h('div', { class: 'atlas-kpi' }, [h('div', { class: 'atlas-card__value', text: ctx.fmt(v, m.format) })]);
    if (target != null && v != null) {
      var good = higher ? v >= target : v <= target;
      var delta = target ? (v - target) / Math.abs(target) : 0;
      var status = h('div', { class: 'atlas-kpi__status atlas-kpi__status--' + (good ? 'good' : 'bad') }, [
        u.icon(good ? 'check' : 'alert'),
        h('span', { text: (good ? (c.goodLabel || 'On target') : (c.badLabel || 'Off target')) + ' · ' + (delta >= 0 ? '+' : '') + ctx.fmt(delta, 'percent') + ' vs ' + ctx.fmt(target, m.format) })
      ]);
      box.appendChild(status);
    } else if (c.label) box.appendChild(h('div', { class: 'atlas-card__label', text: c.label }));
    ctx.el.appendChild(box);
    var table = [{ m: m.label, v: v }];
    if (target != null) table.push({ m: 'Target', v: target });
    if (c.trend) {
      var d = ctx.categorize({ category: c.trend, grain: c.grain || 'month', series: null, measures: [m], sort: 'category', top: null });
      if (d.keys.length > 1) {
        var spark = h('div', { class: 'atlas-kpi__spark' });
        box.appendChild(spark);
        var saveEl = ctx.el;
        ctx.el = spark;
        ctx.chart({
          animation: false,
          grid: { left: 2, right: 2, top: 4, bottom: 2 },
          tooltip: { trigger: 'axis', valueFormatter: function (x) { return ctx.fmt(x, m.format); } },
          xAxis: { type: 'category', data: d.labels, show: false, boundaryGap: false },
          yAxis: { type: 'value', show: false, scale: true },
          series: [{ type: 'line', data: d.series[0].values, symbol: 'none', lineStyle: { width: 2, color: t.palette[0] }, areaStyle: { color: t.palette[0], opacity: 0.12 } }]
        }, { height: 48 });
        ctx.el = saveEl;
      }
    }
    ctx.setTable([{ key: 'm', label: 'Measure' }, { key: 'v', label: 'Value', format: m.format, numeric: true }], table);
  }
  Atlas.registerVisual('kpi', kpi, { span: 3 });

  /** Table: raw rows, or grouped with `groupBy` + aggregated measure columns. Sortable, optional totals and data bars. */
  function table(ctx) {
    var c = ctx.config, dash = ctx.dashboard;
    var columns, rows, footer = null;
    var groupFields = toArray(c.groupBy);
    if (groupFields.length) {
      var dims = groupFields.map(function (f) { return ctx.dimension(f); });
      var ms = toArray(c.columns || c.values || c.value).map(function (x) { return ctx.measure(x); });
      if (!ms.length) ms = [ctx.measure(null)];
      columns = dims.map(function (d, i) { return { key: 'g' + i, label: d.meta.label }; }).concat(ms.map(function (m, i) {
        return { key: 'm' + i, label: m.label, format: m.format, numeric: true };
      }));
      rows = [];
      u.groupBy(ctx.rows, function (r) { return dims.map(function (d) { return d.key(r); }).join('\u0000'); }).forEach(function (bucket, k) {
        var parts = k.split('\u0000'), row = {};
        dims.forEach(function (d, i) { row['g' + i] = d.label(parts[i]); });
        ms.forEach(function (m, i) { row['m' + i] = ctx.aggregate(bucket, m); });
        rows.push(row);
      });
      if (c.totals !== false) {
        footer = { g0: 'Total' };
        ms.forEach(function (m, i) { footer['m' + i] = ctx.aggregate(ctx.rows, m); });
      }
    } else {
      var spec = c.columns ? toArray(c.columns) : dash.fieldOrder;
      columns = spec.map(function (s) {
        if (typeof s === 'string') s = { field: s };
        var meta = ctx.field(s.field);
        return { key: s.field, label: s.label || meta.label, format: s.format || meta.format, numeric: meta.type === 'number' };
      });
      rows = ctx.rows;
      if (c.totals) {
        footer = {};
        columns.forEach(function (col, i) {
          if (col.numeric) footer[col.key] = ctx.aggregate(ctx.rows, ctx.measure({ field: col.key, agg: 'sum' }));
          else if (i === 0) footer[col.key] = 'Total';
        });
      }
    }
    if (!rows.length) return ctx.empty();
    var sortState = ctx.state.sort || (ctx.state.sort = c.sort ? { key: sortKey(c.sort.field, columns, groupFields, c), dir: c.sort.dir || 'desc' } : {});
    var dataBars = toArray(c.dataBars).map(function (f) { return sortKey(f, columns, groupFields, c); });
    ctx.el.appendChild(u.renderTable(dash, { columns: columns, rows: rows }, {
      sortState: sortState, footer: footer, limit: c.limit || 100, dataBars: dataBars
    }));
    ctx.setTable(columns, rows);
  }
  /** Map a field name to the column key used internally (grouped tables use g0/m0 keys). */
  function sortKey(field, columns, groupFields, c) {
    if (!groupFields.length) return field;
    var gi = groupFields.indexOf(field);
    if (gi >= 0) return 'g' + gi;
    var ms = toArray(c.columns || c.values || c.value);
    for (var i = 0; i < ms.length; i++) if ((typeof ms[i] === 'string' ? ms[i] : ms[i].field) === field) return 'm' + i;
    return field;
  }
  Atlas.registerVisual('table', table, { span: 12 });

  /** Matrix (pivot table): rows × optional column field, with row and column totals. */
  function matrix(ctx) {
    var c = ctx.config, dash = ctx.dashboard;
    var rowFields = toArray(c.rows);
    if (!rowFields.length) throw new Error('matrix needs "rows": ["field", ...]');
    var rdims = rowFields.map(function (f) { return ctx.dimension(f); });
    var ms = ctx.measures();
    var cd = c.columns ? ctx.dimension(c.columns) : null;
    var rowKey = function (r) { return rdims.map(function (d) { return d.key(r); }).join('\u0000'); };
    var colKeys = cd ? Array.from(u.groupBy(ctx.rows, cd.key).keys()).sort(function (a, b) { return String(a).localeCompare(String(b), undefined, { numeric: true }); }) : null;
    if (cd && c.columnOrder) colKeys = c.columnOrder.filter(function (k) { return colKeys.indexOf(k) >= 0; });
    var columns = rdims.map(function (d, i) { return { key: 'r' + i, label: d.meta.label }; });
    if (cd) {
      var m0 = ms[0];
      colKeys.forEach(function (k, i) { columns.push({ key: 'c' + i, label: cd.label(k), format: m0.format, numeric: true }); });
      if (c.totals !== false) columns.push({ key: 'total', label: 'Total', format: m0.format, numeric: true });
    } else {
      ms.forEach(function (m, i) { columns.push({ key: 'm' + i, label: m.label, format: m.format, numeric: true }); });
    }
    var rows = [];
    u.groupBy(ctx.rows, rowKey).forEach(function (bucket, k) {
      var parts = k.split('\u0000'), row = {};
      rdims.forEach(function (d, i) { row['r' + i] = d.label(parts[i]); });
      if (cd) {
        var byCol = u.groupBy(bucket, cd.key);
        colKeys.forEach(function (ck, i) { row['c' + i] = byCol.has(ck) ? ctx.aggregate(byCol.get(ck), ms[0]) : null; });
        row.total = ctx.aggregate(bucket, ms[0]);
        row._sort = row.total;
      } else {
        ms.forEach(function (m, i) { row['m' + i] = ctx.aggregate(bucket, m); });
        row._sort = row.m0;
      }
      rows.push(row);
    });
    if (!rows.length) return ctx.empty();
    if (c.sort !== 'none') rows.sort(function (a, b) { return (b._sort || 0) - (a._sort || 0); });
    var footer = null;
    if (c.totals !== false) {
      footer = { r0: 'Total' };
      if (cd) {
        var byColAll = u.groupBy(ctx.rows, cd.key);
        colKeys.forEach(function (ck, i) { footer['c' + i] = ctx.aggregate(byColAll.get(ck) || [], ms[0]); });
        footer.total = ctx.aggregate(ctx.rows, ms[0]);
      } else ms.forEach(function (m, i) { footer['m' + i] = ctx.aggregate(ctx.rows, m); });
    }
    ctx.el.appendChild(u.renderTable(dash, { columns: columns, rows: rows }, {
      sortState: ctx.state.sort || (ctx.state.sort = {}), footer: footer, rowHeaders: true, limit: c.limit || 500,
      dataBars: c.dataBars ? columns.filter(function (col) { return col.numeric && col.key !== 'total'; }).map(function (col) { return col.key; }) : []
    }));
    ctx.setTable(columns, footer ? rows.concat([footer]) : rows);
  }
  Atlas.registerVisual('matrix', matrix, { span: 12 });

  /**
   * Text with live numbers ("smart narrative" lite).
   * Tokens: {{sum:revenue}}, {{avg:margin|percent}}, {{distinct:customer}}, {{rows}}.
   * **bold** is supported; everything else is escaped.
   */
  function text(ctx) {
    var c = ctx.config;
    var src = toArray(c.text).join('\n\n');
    var html = u.escapeHtml(src).replace(/\{\{\s*([a-zA-Z]+)(?::([^}|]+?))?(?:\|([a-zA-Z]+))?\s*\}\}/g, function (_, agg, field, fmt) {
      if (agg === 'rows') return u.escapeHtml(ctx.fmt(ctx.rows.length, fmt || 'integer'));
      var m = ctx.measure({ field: field && field.trim(), agg: agg, format: fmt });
      return '<strong>' + u.escapeHtml(ctx.fmt(ctx.aggregate(ctx.rows, m), m.format)) + '</strong>';
    }).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    ctx.el.appendChild(h('div', { class: 'atlas-text', html: html.split(/\n{2,}/).map(function (p) { return '<p>' + p.replace(/\n/g, '<br>') + '</p>'; }).join('') }));
  }
  Atlas.registerVisual('text', text, { span: 12 });

  /** Raw HTML block written by the dashboard author (trusted content only). */
  Atlas.registerVisual('html', function (ctx) {
    ctx.el.appendChild(h('div', { html: ctx.config.html || '' }));
  }, { span: 12 });
})(window.Atlas);
