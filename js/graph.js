// ============================================================
// ANZAR — Graph View
// Logic: recovery branch (IndexedDB, modular, stopGraph cleanup)
// Output: main branch Brutalist Swiss design
// ============================================================

import { getAll } from './storage.js';

let _simulation = null;

export function stopGraph() {
  if (_simulation) {
    _simulation.stop();
    _simulation = null;
  }
}

export async function renderGraph(container) {
  stopGraph();

  container.innerHTML = `
    <div class="graph-view">
      <h2>Note Graph</h2>
      <div class="graph-container" id="graphContainer"></div>
      <div class="graph-legend">
        <span class="legend-item"><span class="legend-dot" style="background:#7FA6DA"></span>No tag</span>
        <span class="legend-item"><span class="legend-dot" style="background:#E45858"></span>urgent / high</span>
        <span class="legend-item"><span class="legend-dot" style="background:#4CAF7D"></span>daily / journal</span>
        <span class="legend-item"><span class="legend-dot" style="background:#F2A93B"></span>ideas / projects</span>
        <span class="legend-item"><span class="legend-dot" style="background:#9B59B6"></span>other</span>
      </div>
    </div>
  `;

  const notes = await getAll('notes');
  const graphContainer = container.querySelector('#graphContainer');

  if (!notes || notes.length === 0) {
    graphContainer.innerHTML = '<div class="empty-state">Create notes with [[links]] between them to see the graph.</div>';
    return;
  }

  const width  = graphContainer.clientWidth  || 800;
  const height = 500;

  const nodeMap = {};
  notes.forEach(n => { nodeMap[n.title.toLowerCase()] = n.id; });

  const nodes = notes.map(n => ({
    id:     n.id,
    title:  n.title,
    tags:   n.tags || [],
    r:      8 + (n.links?.length || 0) * 2
  }));

  const links = [];
  notes.forEach(n => {
    (n.links || []).forEach(linkTitle => {
      const targetId = nodeMap[linkTitle.toLowerCase()];
      if (targetId && targetId !== n.id) {
        links.push({ source: n.id, target: targetId });
      }
    });
  });

  const colorMap = {
    urgent: '#E45858', high: '#E45858',
    daily: '#4CAF7D', journal: '#4CAF7D',
    ideas: '#F2A93B', projects: '#F2A93B',
  };

  const getColor = (tags) => {
    if (!tags || tags.length === 0) return '#7FA6DA';
    return colorMap[tags[0].toLowerCase()] || '#9B59B6';
  };

  const svg = d3.select(graphContainer)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height]);

  const g = svg.append('g');

  // Zoom
  svg.call(
    d3.zoom()
      .extent([[0, 0], [width, height]])
      .scaleExtent([0.4, 5])
      .on('zoom', (event) => g.attr('transform', event.transform))
  );

  // Simulation
  _simulation = d3.forceSimulation(nodes)
    .force('link',      d3.forceLink(links).id(d => d.id).distance(120))
    .force('charge',    d3.forceManyBody().strength(-300))
    .force('center',    d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(d => d.r + 8));

  // Links
  const link = g.append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke', 'var(--ink-muted)')
    .attr('stroke-opacity', 0.5)
    .attr('stroke-width', 1.5);

  // Nodes
  const node = g.append('g')
    .selectAll('circle')
    .data(nodes)
    .join('circle')
    .attr('r',            d => d.r)
    .attr('fill',         d => getColor(d.tags))
    .attr('stroke',       'var(--bg)')
    .attr('stroke-width', 2)
    .style('cursor', 'pointer')
    .call(
      d3.drag()
        .on('start', (event, d) => { if (!event.active) _simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag',  (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end',   (event, d) => { if (!event.active) _simulation.alphaTarget(0); d.fx = null; d.fy = null; })
    );

  // Labels
  const label = g.append('g')
    .selectAll('text')
    .data(nodes)
    .join('text')
    .text(d => d.title)
    .attr('font-size',   11)
    .attr('fill',        'var(--ink)')
    .attr('text-anchor', 'middle')
    .attr('dy',          d => d.r + 14)
    .attr('font-family', 'var(--font-display)')
    .style('pointer-events', 'none');

  // Click node → open note
  node.on('click', async (event, d) => {
    // Switch to notes view via app router
    const btn = document.querySelector('.nav-btn[data-view="notes"]');
    if (btn) btn.click();
    // Store note id for notes module to pick up
    window.__anzar_open_note = d.id;
  });

  node
    .on('mouseover', function() { d3.select(this).attr('stroke', 'var(--accent)').attr('stroke-width', 3); })
    .on('mouseout',  function() { d3.select(this).attr('stroke', 'var(--bg)').attr('stroke-width', 2); });

  // Tick
  _simulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    node.attr('cx', d => d.x).attr('cy', d => d.y);
    label.attr('x', d => d.x).attr('y', d => d.y);
  });
}