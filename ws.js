(function() {
  "use strict";

  var word_node = {};
  function extract_graph(synsets, query, max_synsets, negate) {
    negate = !!negate;
    var re = new RegExp(query, "i");
    var count_synsets = 0;
    var graph = { nodes: [], links: [] };
    var word_added = {};
    var i;
    for (i = 0; i < synsets.length; ++i) {
      var synset = synsets[i];
      var matched = synset.words.some(function(w) { return re.exec(w); });
      if (matched != negate) {
        count_synsets += 1;
        var synset_node = {
          id: "synset:" + i,
          synset_id: i,
          gloss: synset.gloss
        };
        var word_nodes = [];
        synset.words.forEach(function(w) {
          if (!word_added[w]) {
            if (!word_node[w]) {
              word_node[w] = {
                id: w,
                word: w
              };
            }
            var n = word_node[w];
            n.matched = !!re.exec(w);
            word_nodes.push(n);
            word_added[w] = true;
          }
        });
        var links = synset.words.map(function(w) {
          var wn = word_node[w];
          return {
            id: "link:" + synset_node.id + ":" + wn.id,
            source: synset_node,
            target: wn
          };
        });
        graph.nodes = graph.nodes.concat(synset_node, word_nodes);
        graph.links = graph.links.concat(links);
        if (count_synsets == max_synsets) {
          ++i;
          break;
        }
      }
    }
    return {
      graph: graph,
      num_synsets_checked: i,
      num_synsets_matched: count_synsets
    };
  }

  function getCanvasSize() {
    return [window.innerWidth, window.innerHeight];
  }

  function getopt(f) {
    window.location.search.slice(1).split("&").forEach(function(param) {
      var kv = param.split("=");
      var key = decodeURIComponent(kv[0]);
      var value = decodeURIComponent(kv[1]);
      f(key, value);
    });
  }

  var data_name = "synsets.json";
  var limit = 100;
  getopt(function(key, value) {
    switch (key) {
    case "lang":
      switch (value) {
      case "en":
        data_name = "synsets.json";
        break;
      case "ja":
        data_name = "synsets_ja.json";
        break;
      default:
        alert('No data available for language "' + value + '".');
        break;
      }
      break;
    case "limit":
      value = parseInt(value);
      if (isNaN(value)) {
        limit = 50;
      }
      else {
        limit = value;
      }
      break;
    }
  });

  var color = function(h) {
    let colorStr = d3.interpolateRainbow(h);
    let result = /rgb\((\d+), (\d+), (\d+)\)/.exec(colorStr);
    return parseInt(result[1]) * 0x10000 + parseInt(result[2]) * 0x100 + parseInt(result[3]) * 0x1;
  };
  let [width, height] = getCanvasSize();
  let scale = 1.0;
  let fgSimulation = d3.forceSimulation()
    .alphaTarget(1);
  fgSimulation.forceLink = d3.forceLink()
    .id(function(d) { return d.id; })
    .distance(50);
  fgSimulation.forceManyBody = d3.forceManyBody()
    .strength(function() {
      return -(20**scale);
    });
  fgSimulation.forceCenter = d3.forceCenter(0, 0);
  fgSimulation.forceX = d3.forceX(0)
    .strength(0.04);
  fgSimulation.forceY = d3.forceY(0)
    .strength(0.04);
  fgSimulation
    .force("link", fgSimulation.forceLink)
    .force("charge", fgSimulation.forceManyBody)
    .force("center", fgSimulation.forceCenter)
    .force("x", fgSimulation.forceX)
    .force("y", fgSimulation.forceY);
  let bgSimulation = d3.forceSimulation()
    .alphaTarget(1);
  bgSimulation.forceLink = d3.forceLink()
    .id(function(d) { return d.id; })
    .distance(50);
  bgSimulation.forceManyBody = d3.forceManyBody()
    .strength(function() {
      return -(20**scale);
    });
  bgSimulation.forceCenter = d3.forceCenter(0, 0);
  bgSimulation.forceX = d3.forceX(0)
    .strength(0.04);
  bgSimulation.forceY = d3.forceY(0)
    .strength(0.04);
  bgSimulation
    .force("link", bgSimulation.forceLink)
    .force("charge", bgSimulation.forceManyBody)
    .force("center", bgSimulation.forceCenter)
    .force("x", bgSimulation.forceX)
    .force("y", bgSimulation.forceY);
  const app = new PIXI.Application({
    backgroundColor: 0xffffff,
    antialias: true,
    resolution: window.devicePixelRatio,
  });
  app.renderer.autoResize = true;
  app.stage.interactive = true;
  const fgLayer = new PIXI.Container();
  const bgLayer = new PIXI.Container();
  app.stage.addChild(bgLayer);
  app.stage.addChild(fgLayer);
  bgLayer.alpha = 0.5;
  bgLayer.filters = [new PIXI.filters.BlurFilter()];
  document.body.insertBefore(app.view, document.body.firstChild);
  window.addEventListener("resize", function() {
    let [width, height] = getCanvasSize();
    app.renderer.resize(width, height);

    // Center the origin of the stage
    app.stage.x = width / 2;
    app.stage.y = height / 2;
    app.stage.hitArea = app.screen.clone();
    app.stage.hitArea.x = -width / 2;
    app.stage.hitArea.y = -height / 2;
  });
  window.addEventListener("DOMContentLoaded", function() {
    let [width, height] = getCanvasSize();
    app.renderer.resize(width, height);

    // Center the origin of the stage
    app.stage.x = width / 2;
    app.stage.y = height / 2;
    app.stage.hitArea = app.screen.clone();
    app.stage.hitArea.x = -width / 2;
    app.stage.hitArea.y = -height / 2;
  });

  let grab = null;
  app.stage.on("pointerdown", e => {
    const initLayerPosition = new PIXI.Point(layer.position.x, layer.position.y);
    grab = {
      initLayerPosition: initLayerPosition,
      initPointerPosition: e.data.global.clone(),
      data: e.data,
    };
  });
  app.stage.on("pointermove", e => {
    if (nodeGrab) {
      const dx = nodeGrab.data.global.x - nodeGrab.initPointerPosition.x;
      const dy = nodeGrab.data.global.y - nodeGrab.initPointerPosition.y;
      nodeGrab.node.fx = nodeGrab.initNodePosition.x + dx;
      nodeGrab.node.fy = nodeGrab.initNodePosition.y + dy;
    }
    else if (grab) {
      const dx = grab.data.global.x - grab.initPointerPosition.x;
      const dy = grab.data.global.y - grab.initPointerPosition.y;
      layer.position.x = grab.initLayerPosition.x + dx;
      layer.position.y = grab.initLayerPosition.y + dy;
    }
  });
  app.stage.on("pointerup", e => {
    if (nodeGrab) {
      nodeGrab.node.fx = null;
      nodeGrab.node.fy = null;
    }
    nodeGrab = null;
    grab = null;
  });
  app.stage.on("pointerupoutside", e => {
    if (nodeGrab) {
      nodeGrab.node.fx = null;
      nodeGrab.node.fy = null;
    }
    nodeGrab = null;
    grab = null;
  });

  var fgGraph = null;
  var bgGraph = null;
  function draw(graph) {
    graph.links.forEach(d => {
      let line = d.graphics;
      line.clear();
      line.lineStyle(2, 0x888888, 1);
      line.moveTo(d.source.x, d.source.y);
      line.lineTo(d.target.x, d.target.y);
    });

    graph.nodes.forEach(d => {
      let container = d.graphics;
      container.x = d.x;
      container.y = d.y;
    });
  }

  let nodeGrab = null;
  function makeNodeDraggable(graphics, node) {
    graphics.on("pointerdown", e => {
      const initNodePosition = new PIXI.Point(node.x, node.y);
      nodeGrab = {
        initNodePosition: initNodePosition,
        initPointerPosition: e.data.global.clone(),
        node: node,
        data: e.data,
      };

      e.stopPropagation();
    });
  }

  function updateLayer(layer, graph) {
    layer.removeChildren();

    graph.links.forEach(d => {
      let line = new PIXI.Graphics();
      line.lineStyle(2, 0x888888, 1);
      line.moveTo(d.source.x, d.source.y);
      line.lineTo(d.target.x, d.target.y);
      layer.addChild(line);
      d.graphics = line;
    });

    let textStyle = new PIXI.TextStyle({
      fontSize: 12,
      fill: "#666",
    });
    graph.nodes.forEach(d => {
      let radius = d.word ? 5 : 10;
      let fillColor = d.word ? 0x888888 : color((d.synset_id % limit) / limit);
      let container = new PIXI.Container();
      container.interactive = true;
      container.buttonMode = true;
      makeNodeDraggable(container, d);
      let circle = new PIXI.Graphics();
      circle.lineStyle(2, 0xffffff, 1);
      circle.beginFill(fillColor)
      circle.drawCircle(0, 0, radius)
      circle.endFill()
      container.addChild(circle);

      if (d.word) {
        // FIXME Coloring according to d.matched is not implemented
        let text = new PIXI.Text(d.word, textStyle);
        text.anchor.set(0, 0.6);
        text.x = 8;
        text.y = 0;
        container.addChild(text);
      }

      container.x = d.x
      container.y = d.y
      layer.addChild(container);
      d.graphics = container;
    });
  }

  function setNormalSimulation(simulation, graph) {
    simulation.forceLink.distance(50);
    simulation.forceManyBody.strength(function(d) {
      return -(20**scale);
    });
    simulation.forceX.strength(0.04);
    simulation.forceY.strength(0.04);

    simulation
      .nodes(graph.nodes)
      .on("tick", function() { draw(graph); });
    simulation.force("link")
      .links(graph.links);
  }

  function toGraph(str) {
    var ws = str.split(/\s/);

    var graph = { nodes: [], links: [] };
    graph.nodes[0] = { id: 0, text: ws[0] };

    for (var i = 1; i < ws.length; ++i) {
      graph.nodes.push({ id: i, text: ws[i] });
      graph.links.push({ source: i - 1, target: i });
    }

    return graph;
  }

  function showMessage(msg) {
    var graph = toGraph(msg);
    fgGraph = graph;

    graph.nodes.forEach(function(d, i) {
      d.x = 100 * i;
      d.y = 100 * (2 * Math.random() - 1);
    });

    fgLayer.removeChildren();

    graph.links.forEach(d => {
      let line = new PIXI.Graphics();
      line.lineStyle(2, 0x888888, 1);
      line.moveTo(d.source.x, d.source.y);
      line.lineTo(d.target.x, d.target.y);
      fgLayer.addChild(line);
      d.graphics = line;
    });

    let textStyle = new PIXI.TextStyle({
      fontSize: 20,
      fill: "#000",
    });
    graph.nodes.forEach(d => {
      let radius = 10 * d.text.length + 10;
      let fillColor = color(d.id / graph.nodes.length);
      let container = new PIXI.Container();
      let circle = new PIXI.Graphics();
      circle.lineStyle(2, 0xffffff, 1);
      circle.beginFill(fillColor)
      circle.drawCircle(0, 0, radius)
      circle.endFill()
      container.addChild(circle);

      let text = new PIXI.Text(d.text, textStyle);
      text.anchor.set(0.5, 0.5);
      container.addChild(text);

      container.x = d.x
      container.y = d.y
      fgLayer.addChild(container);
      d.graphics = container;
    });

    fgSimulation.forceLink.distance(function(l) {
      let r1 = 10 * l.source.text.length + 10;
      let r2 = 10 * l.target.text.length + 10;
      return 1.5 * (r1 + r2);
    });
    fgSimulation.forceManyBody.strength(function(d) {
      return -5 * d.text.length;
    });
    fgSimulation.forceX.strength(0.001);
    fgSimulation.forceY.strength(0.004);

    fgSimulation
      .nodes(graph.nodes)
      .on("tick", function() { draw(graph); });
    fgSimulation.force("link")
      .links(graph.links);
  }

  var synsets = null;
  showMessage("Now Loading . . .");
  d3.json(data_name).then(function(data) {
    synsets = data;

    let query = document.querySelector("#query").value;
    var r = extract_graph(synsets, query, limit);
    if (r.num_synsets_checked < synsets.length) {
      d3.select("#message").text(`(+${limit} synsets found)`);
    }
    else {
      d3.select("#message").text("(" + r.num_synsets_matched + " synsets found)");
    }

    if (query == '') {
      fgGraph = r.graph;
      bgGraph = { nodes: [], links: [] };
      updateLayer(fgLayer, fgGraph);
      updateLayer(bgLayer, bgGraph);
    }
    else {
      var r2 = extract_graph(synsets, query, limit, true);
      fgGraph = r.graph;
      bgGraph = r2.graph;
      updateLayer(fgLayer, fgGraph);
      updateLayer(bgLayer, bgGraph);
    }
    setNormalSimulation(fgSimulation, fgGraph);
    setNormalSimulation(bgSimulation, bgGraph);
  });

  document.addEventListener("keydown", function() {
    document.querySelector("#query").focus();
  });

  d3.select("#query").on("input", function() {
    var query = this.value;
    var r = extract_graph(synsets, query, limit);
    if (r.num_synsets_checked < synsets.length) {
      d3.select("#message").text(`(+${limit} synsets found)`);
    }
    else {
      d3.select("#message").text("(" + r.num_synsets_matched + " synsets found)");
    }

    if (query == '') {
      fgGraph = r.graph;
      bgGraph = { nodes: [], links: [] };
      updateLayer(fgLayer, fgGraph);
      updateLayer(bgLayer, bgGraph);
    }
    else {
      var r2 = extract_graph(synsets, query, limit, true);
      fgGraph = r.graph;
      bgGraph = r2.graph;
      updateLayer(fgLayer, fgGraph);
      updateLayer(bgLayer, bgGraph);
    }
    setNormalSimulation(fgSimulation, fgGraph);
    setNormalSimulation(bgSimulation, bgGraph);
  });

  function on_wheel(e) {
    e.stopPropagation();
    e.preventDefault();
    var delta =   e.deltaY       // 'wheel' event
      || -e.wheelDeltaY  // Webkit's mousewheel event
      || -e.wheelDelta;  // other's mousewheel event
    if (delta > 0) {
      scale -= 0.1;
    }
    else if (delta < 0) {
      scale += 0.1;
    }
    forceManyBody.strength(forceManyBody.strength());
  }
  document.addEventListener("wheel", on_wheel);
  document.addEventListener("mousewheel", on_wheel);
  document.addEventListener("DOMMouseScroll", on_wheel);
})();
