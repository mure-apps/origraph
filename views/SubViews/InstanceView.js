/* globals d3, origraph */
import GoldenLayoutView from './GoldenLayoutView.js';
import ZoomableSvgViewMixin from './ZoomableSvgViewMixin.js';

const NODE_SIZE = 7;

const REPULSION = node => {
  if (node.nodeInstance) {
    const instanceId = node.nodeInstance.instanceId;
    if (window.mainView.instanceGraph.highlightedSample[instanceId]) {
      return -1000;
    } else if (window.mainView.instanceGraph.highlightNeighbors[instanceId]) {
      return -100;
    }
  }
  return -50;
};

const FORCES = {
  link: d3.forceLink(),
  charge: d3.forceManyBody().strength(REPULSION),
  center: d3.forceCenter(),
  collide: d3.forceCollide().radius(NODE_SIZE)
};

class InstanceView extends ZoomableSvgViewMixin(GoldenLayoutView) {
  constructor ({ container, state }) {
    super({
      container,
      icon: InstanceView.icon,
      label: InstanceView.label,
      state
    });
  }
  isEmpty () {
    return Object.values(origraph.currentModel.classes)
      .filter(d => d.type === 'Node' || d.type === 'Edge').length === 0;
  }
  setup () {
    super.setup();

    this.emptyStateDiv.html(`<h3>At least one node or edge class is needed to sample the graph</h3>`)
      .style('display', null);

    this.content.append('g')
      .classed('edgeLayer', true);
    this.content.append('g')
      .classed('nodeLayer', true);

    this.controls = d3.select(this.content.node().parentNode).append('div')
      .classed('controls', true);
    this.setupButtons();

    this.simulation = d3.forceSimulation();
    for (const [ forceName, forceObj ] of Object.entries(FORCES)) {
      this.simulation.force(forceName, forceObj);
    }
    window.mainView.instanceGraph.on('update', () => {
      this.simulation.alpha(1.0).restart();
      this.render();
    });
  }
  setupButtons () {
    const controls = [
      {
        label: 'Clear',
        icon: 'img/null.svg',
        onClick: () => {
          window.mainView.instanceGraph.clear();
        },
        disabled: () => !origraph.currentModel ||
          Object.values(origraph.currentModel.classes)
            .every(classObj => classObj.type === 'Generic'),
        selected: () => window.mainView.instanceGraph.mode === 'EMPTY'
      },
      {
        label: 'Seed Neighborhood',
        icon: 'img/neighborhood.svg',
        onClick: () => {
          if (window.mainView.instanceGraph.highlightCount > 0) {
            window.mainView.instanceGraph
              .seedNeighbors(window.mainView.instanceGraph.highlightedSample);
          }
        },
        disabled: () => window.mainView.instanceGraph.highlightCount === 0
      },
      {
        label: 'Seed Class...',
        icon: 'img/convert.svg',
        onClick: function () {
          const menuEntries = {};
          for (const classObj of Object.values(origraph.currentModel.classes)) {
            if (classObj.type === 'Node' || classObj.type === 'Edge') {
              let baseEntryName = classObj.className;
              let i = 2;
              let entryName = baseEntryName;
              while (menuEntries[entryName]) {
                entryName = `${baseEntryName} (${i})`;
                i++;
              }
              menuEntries[entryName] = {
                icon: `img/${classObj.lowerCamelCaseType}.svg`,
                onClick: () => {
                  window.mainView.instanceGraph.seedClass(classObj);
                },
                postProcess: element => {
                  d3.select(element).style('background-color', '#' + window.mainView.getClassColor(classObj));
                }
              };
            }
          }
          window.mainView.showContextMenu({
            targetBounds: this.getBoundingClientRect(),
            menuEntries
          });
        },
        disabled: () => !origraph.currentModel ||
          Object.values(origraph.currentModel.classes)
            .every(classObj => classObj.type === 'Generic'),
        selected: () => window.mainView.instanceGraph.mode === 'FULL_CLASS'
      },
      {
        label: 'Default Sampling',
        icon: 'img/defaultSamples.svg',
        onClick: () => {
          window.mainView.instanceGraph.reset();
        },
        disabled: () => !origraph.currentModel ||
          Object.values(origraph.currentModel.classes)
            .every(classObj => classObj.type === 'Generic'),
        selected: () => window.mainView.instanceGraph.mode === 'DEFAULT'
      }
    ];
    let buttons = this.controls.selectAll('.button').data(controls);
    buttons.exit().remove();
    const buttonsEnter = buttons.enter().append('div')
      .classed('button', true);
    buttons = buttons.merge(buttonsEnter);

    buttonsEnter.append('a').append('img');
    buttons.select('img').attr('src', d => d.icon);
    buttons.on('mouseenter', function (d) {
      window.mainView.showTooltip({
        content: d.label,
        targetBounds: this.getBoundingClientRect()
      });
    }).on('click', function (d) { d.onClick.call(this); });
  }
  drawButtons () {
    this.controls.selectAll('.button')
      .classed('disabled', d => d.disabled && d.disabled());
    this.controls.selectAll('.button')
      .classed('selected', d => d.selected && d.selected());
  }
  draw () {
    super.draw();
    const bounds = this.getContentBounds(this.content);

    this.drawButtons();

    let nodes = this.content.select('.nodeLayer')
      .selectAll('.node').data(window.mainView.instanceGraph.nodes);
    nodes.exit().remove();
    const nodesEnter = nodes.enter().append('g')
      .classed('node', true);
    nodes = nodes.merge(nodesEnter);

    nodesEnter.append('circle')
      .attr('r', NODE_SIZE);
    nodes.select('circle')
      .attr('fill', d => d.nodeInstance
        ? '#' + window.mainView.getClassColor(d.nodeInstance.classObj) : '#BDBDBD');

    nodesEnter.append('text')
      .attr('y', '1.35em')
      .attr('text-anchor', 'middle');
    nodes.select('text')
      .text(d => d.nodeInstance ? d.nodeInstance.label : '');

    nodes.classed('highlighted', d => d.nodeInstance &&
      window.mainView.instanceGraph.highlightedSample[d.nodeInstance.instanceId]);
    // Show the labels for all neighbors of the highlighted instance
    nodes.classed('highlightedNeighbor', d => d.nodeInstance &&
      window.mainView.instanceGraph.highlightNeighbors[d.nodeInstance.instanceId]);
    nodes.classed('dummy', d => d.dummy)
      .call(d3.drag()
        .on('start', d => {
          if (!d3.event.active) {
            this.simulation.alphaTarget(0.3).restart();
          }
          d.fx = d.x;
          d.fy = d.y;
        }).on('drag', d => {
          d.fx = d3.event.x;
          d.fy = d3.event.y;
        }).on('end', d => {
          if (!d3.event.active) {
            this.simulation.alphaTarget(0);
          }
          delete d.fx;
          delete d.fy;
          // Highlight the dragged node when the mouse is released
          if (d.nodeInstance) {
            const sample = {};
            sample[d.nodeInstance.instanceId] = d.nodeInstance;
            window.mainView.highlightSample(sample, this);
          } else {
            window.mainView.clearHighlightSample();
          }
        }));

    let edges = this.content.select('.edgeLayer')
      .selectAll('.edge').data(window.mainView.instanceGraph.edges);
    edges.exit().remove();
    const edgesEnter = edges.enter().append('g')
      .classed('edge', true);
    edges = edges.merge(edgesEnter);

    edgesEnter.append('path')
      .classed('line', true);
    edges.select('.line')
      .attr('stroke', d => '#' + window.mainView.getClassColor(d.edgeInstance.classObj));

    edges.on('click', d => {
      const sample = {};
      sample[d.edgeInstance.instanceId] = d.edgeInstance;
      window.mainView.highlightSample(sample, this);
    });

    edges.classed('highlighted', d => window.mainView.instanceGraph
      .highlightedSample[d.edgeInstance.instanceId]);

    this.simulation.on('tick', () => {
      edges.select('.line')
        .attr('d', d => {
          if (d.source === d.target) {
            return `M${d.source.x},${d.source.y}
                    C${d.source.x - 4 * NODE_SIZE},${d.source.y},
                     ${d.source.x},${d.source.y - 4 * NODE_SIZE},
                     ${d.source.x},${d.source.y}`;
          } else {
            return `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`;
          }
        });
      nodes.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    this.simulation.nodes(window.mainView.instanceGraph.nodes);
    this.simulation.force('link').links(window.mainView.instanceGraph.edges);
    this.simulation.force('center').x(bounds.width / 2).y(bounds.height / 2);
    this.simulation.force('charge').strength(REPULSION);
  }
}
InstanceView.icon = 'img/instanceView.svg';
InstanceView.label = 'Network Sample';
export default InstanceView;
