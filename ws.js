(function() {
  "use strict";

  var word_node = {};
  function extract_graph(synsets, query, max_synsets) {
    var re = new RegExp(query, "i");
    var count_synsets = 0;
    var graph = { nodes: [], links: [] };
    var word_added = {};
    var i;
    for (i = 0; i < synsets.length; ++i) {
      var synset = synsets[i];
      var matched = synset.words.some(function(w) { return re.exec(w); });
      if (matched) {
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
  let forceLink = d3.forceLink()
    .id(function(d) { return d.id; })
    .distance(50);
  let forceManyBody = d3.forceManyBody()
    .strength(function() {
      return -(20**scale);
    });
  let forceCenter = d3.forceCenter(0, 0);
  let forceX = d3.forceX(0)
    .strength(0.04);
  let forceY = d3.forceY(0)
    .strength(0.04);
  let simulation = d3.forceSimulation()
    .alphaTarget(1)
    .force("link", forceLink)
    .force("charge", forceManyBody)
    .force("center", forceCenter)
    .force("x", forceX)
    .force("y", forceY);
  const app = new PIXI.Application({
    backgroundColor: 0xffffff,
    antialias: true,
    resolution: 2,
  });
  app.renderer.autoResize = true;
  app.stage.interactive = true;
  const layer = new PIXI.Container();
  app.stage.addChild(layer);
  document.body.insertBefore(app.view, document.body.firstChild);
  var canvas = app.view;
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
    if (grab) {
      const dx = grab.data.global.x - grab.initPointerPosition.x;
      const dy = grab.data.global.y - grab.initPointerPosition.y;
      layer.position.x = grab.initLayerPosition.x + dx;
      layer.position.y = grab.initLayerPosition.y + dy;
    }
  });
  app.stage.on("pointerup", e => {
    grab = null;
  });
  app.stage.on("pointerupoutside", e => {
    grab = null;
  });

  var scrollX = 0;
  var scrollY = 0;
  d3.select(canvas)
    .call(d3.drag()
      .container(canvas)
      .subject(dragsubject)
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended));
  var currentGraph = null;
  function draw() {
    if (!currentGraph) return;

    currentGraph.links.forEach(d => {
      let line = d.graphics;
      line.clear();
      line.lineStyle(2, 0x888888, 1);
      line.moveTo(d.source.x, d.source.y);
      line.lineTo(d.target.x, d.target.y);
    });

    currentGraph.nodes.forEach(d => {
      let container = d.graphics;
      container.x = d.x;
      container.y = d.y;
    });
  }

  function update(graph) {
    currentGraph = graph;

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

    forceLink.distance(50);
    forceManyBody.strength(function(d) {
      return -(20**scale);
    });
    forceX.strength(0.04);
    forceY.strength(0.04);

    simulation
      .nodes(graph.nodes)
      .on("tick", draw);
    simulation.force("link")
      .links(graph.links);
  }

  function dragsubject() {
    return simulation.find(d3.event.x, d3.event.y, 10);
  }

  function dragstarted(d) {
    d3.event.subject.fx = d3.event.subject.x;
    d3.event.subject.fy = d3.event.subject.y;
  }

  function dragged(d) {
    d3.event.subject.fx = d3.event.x;
    d3.event.subject.fy = d3.event.y;
  }

  function dragended(d) {
    d3.event.subject.fx = null;
    d3.event.subject.fy = null;
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
    currentGraph = graph;

    graph.nodes.forEach(function(d, i) {
      d.x = 100 * i;
      d.y = 100 * (2 * Math.random() - 1);
    });

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
      fontSize: 20,
      fill: "#000",
    });
    graph.nodes.forEach(d => {
      let radius = 10 * d.text.length + 10;
      let fillColor = color(d.id / currentGraph.nodes.length);
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
      layer.addChild(container);
      d.graphics = container;
    });

    forceLink.distance(function(l) {
      let r1 = 10 * l.source.text.length + 10;
      let r2 = 10 * l.target.text.length + 10;
      return 1.5 * (r1 + r2);
    });
    forceManyBody.strength(function(d) {
      return -5 * d.text.length;
    });
    forceX.strength(0.001);
    forceY.strength(0.004);

    simulation
      .nodes(graph.nodes)
      .on("tick", draw);
    simulation.force("link")
      .links(graph.links);
  }

  var synsets = null;
  showMessage("Now Loading . . .");
  d3.json(data_name).then(function(data) {
    synsets = data;

    var r = extract_graph(synsets, "", limit);
    if (r.num_synsets_checked < synsets.length) {
      d3.select("#message").text(`(+${limit} synsets found)`);
    }
    else {
      d3.select("#message").text("(" + r.num_synsets_matched + " synsets found)");
    }

    update(r.graph);
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

    update(r.graph);
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
