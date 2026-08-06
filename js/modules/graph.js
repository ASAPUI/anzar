export const GraphModule = {
  render(container, data, openNoteFn) {
    const view = document.createElement('div');
    view.className = 'graph-view';
    view.innerHTML = `
      <h2>Note Graph</h2>
      <div class="graph-container" id="graphContainer"></div>
      <div class="graph-legend">
        <span class="legend-item"><span class="legend-dot" style="background:#7FA6DA"></span> Default</span>
        <span class="legend-item"><span class="legend-dot" style="background:#E45858"></span> german</span>
        <span class="legend-item"><span class="legend-dot" style="background:#4CAF7D"></span> french</span>
        <span class="legend-item"><span class="legend-dot" style="background:#F2A93B"></span> language</span>
      </div>
    `;
    container.appendChild(view);

    const graphContainer = view.querySelector('#graphContainer');
    const width = graphContainer.clientWidth || 800;
    const height = 500;

    const nodes = data.notes.map(note => ({
      id: note.id,
      title: note.title,
      tags: note.tags || [],
      radius: 8 + (note.links?.length || 0) * 2
    }));

    const links = [];
    data.notes.forEach(note => {
      (note.links || []).forEach(linkTitle => {
        const target = data.notes.find(n => n.title.toLowerCase() === linkTitle.toLowerCase());
        if (target && target.id !== note.id) {
          links.push({ source: note.id, target: target.id });
        }
      });
    });

    if (nodes.length === 0) {
      graphContainer.innerHTML = '<div class="empty-state">Create some notes with [[links]] to see the graph</div>';
      return;
    }

    const colorMap = {
      'german': '#E45858',
      'french': '#4CAF7D',
      'grammar': '#F2A93B',
      'vocab': '#9B59B6',
      'language': '#F2A93B',
      'schedule': '#1ABC9C'
    };

    const getColor = (tags) => {
      if (!tags || tags.length === 0) return '#7FA6DA';
      return colorMap[tags[0].toLowerCase()] || '#F2A93B';
    };

    const svg = d3.select(graphContainer)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height]);

    const g = svg.append('g');
    svg.call(d3.zoom()
      .extent([[0, 0], [width, height]])
      .scaleExtent([0.5, 4])
      .on('zoom', (event) => g.attr('transform', event.transform)));

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => d.radius + 5));

    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', 'var(--ink-secondary)')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 1.5);

    const node = g.append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', d => d.radius)
      .attr('fill', d => getColor(d.tags))
      .attr('stroke', 'var(--bg)')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .call(d3.drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }));

    const label = g.append('g')
      .selectAll('text')
      .data(nodes)
      .join('text')
      .text(d => d.title)
      .attr('font-size', 11)
      .attr('fill', 'var(--ink)')
      .attr('text-anchor', 'middle')
      .attr('dy', d => d.radius + 14)
      .style('pointer-events', 'none');

    node.on('click', (event, d) => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-view="notes"]').classList.add('active');
      window.App.currentView = 'notes';
      window.NotesModule.openNote(d.id, window.App.data, () => window.App.save());
    });

    node.on('mouseover', function() {
      d3.select(this).attr('stroke', 'var(--accent)').attr('stroke-width', 3);
    }).on('mouseout', function() {
      d3.select(this).attr('stroke', 'var(--bg)').attr('stroke-width', 2);
    });

    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);
      label
        .attr('x', d => d.x)
        .attr('y', d => d.y);
    });
  }
};