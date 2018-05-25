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

  var grab = null;
  d3.select("canvas").on("mousedown", function() {
    if (d3.event.which === 1) {
      grab = {
        pageX: d3.event.pageX,
        pageY: d3.event.pageY,
        scrollX: scrollX,
        scrollY: scrollY
      };
    }
  });
  d3.select("canvas").on("mousemove", function() {
    if (d3.event.which === 1 && grab) {
      scrollX = grab.scrollX + (d3.event.pageX - grab.pageX);
      scrollY = grab.scrollY + (d3.event.pageY - grab.pageY);
      draw();
    }
  });
  d3.select("canvas").on("mouseup", function() {
    if (d3.event.which === 1) {
      grab = null;
    }
  });
  // for touch devices
  d3.select("canvas").on("touchstart", function() {
    d3.event.preventDefault();
    if (!grab) {
      var t = d3.event.changedTouches[0];
      grab = {
        tid: t.identifier,
        pageX: t.pageX,
        pageY: t.pageY,
        scrollX: scrollX,
        scrollY: scrollY
      };
    }
  });
  d3.select("canvas").on("touchmove", function() {
    d3.event.preventDefault();
    if (grab) {
      for (var i = 0; i < d3.event.changedTouches.length; ++i) {
        var t = d3.event.changedTouches[i];
        if (t.identifier === grab.tid) {
          scrollX = grab.scrollX + (t.pageX - grab.pageX);
          scrollY = grab.scrollY + (t.pageY - grab.pageY);
          draw();
          break;
        }
      }
    }
  });
  d3.select("canvas").on("touchend", function() {
    d3.event.preventDefault();
    if (grab) {
      for (var i = 0; i < d3.event.changedTouches.length; ++i) {
        var t = d3.event.changedTouches[i];
        if (t.identifier === grab.tid) {
          grab = null;
          break;
        }
      }
    }
  });

  var color = d3.interpolateRainbow;
  let [width, height] = getCanvasSize();
  let scale = 1.0;
  let forceLink = d3.forceLink()
    .id(function(d) { return d.id; })
    .distance(50);
  let forceManyBody = d3.forceManyBody()
    .strength(function() {
      return -(20**scale);
    });
  let forceCenter = d3.forceCenter(width / 2, height / 2);
  let forceX = d3.forceX(width / 2)
    .strength(0.04);
  let forceY = d3.forceY(height / 2)
    .strength(0.04);
  let simulation = d3.forceSimulation()
    .alphaTarget(1)
    .force("link", forceLink)
    .force("charge", forceManyBody)
    .force("center", forceCenter)
    .force("x", forceX)
    .force("y", forceY)
    .on("tick", draw);
  var canvas = document.querySelector("canvas");
  window.addEventListener("resize", function() {
    let [width, height] = getCanvasSize();
    canvas.width = width;
    canvas.height = height;
    forceCenter.x(width / 2);
    forceCenter.y(height / 2);
    forceX.x(width / 2);
    forceY.y(height / 2);
  });
  window.addEventListener("DOMContentLoaded", function() {
    let [width, height] = getCanvasSize();
    canvas.width = width;
    canvas.height = height;
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

    let [width, height] = getCanvasSize();
    let ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, width, height)

    ctx.beginPath();
    currentGraph.links.forEach((d) => {
      ctx.moveTo(d.source.x, d.source.y);
      ctx.lineTo(d.target.x, d.target.y);
    });
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 2;
    ctx.stroke();

    currentGraph.nodes.forEach((d) => {
      if (d.word) {
        // FIXME Coloring according to d.matched is not implemented
        ctx.fillStyle = "#666";
        ctx.fillText(d.word, d.x + 8, d.y + 4);
      }
    });

    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    currentGraph.nodes.forEach((d) => {
      let radius = d.word ? 5 : 10;
      let fillColor = d.word ? "gray" : color((d.synset_id % limit) / limit);
      let strokeColor = "white";
      ctx.beginPath();
      ctx.arc(d.x, d.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.stroke();
    });
  }

  function update(graph) {
    currentGraph = graph;
    simulation
      .nodes(graph.nodes);
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
    // FIXME
    // var graph = toGraph(msg);
    // var numWords = graph.nodes.length;
    //
    // var link = svg.select("#links")
    //   .selectAll("line")
    //   .data(graph.links, function(d) { return d.id; });
    // var node = svg.select("#nodes")
    //   .selectAll("g")
    //   .data(graph.nodes, function(d) { return d.id; });
    // link.exit().remove();
    // node.exit().remove();
    // link = link.enter()
    //   .append("line");
    // node = node.enter()
    //   .append("g");
    // node.append("circle")
    //   .attr("r", function(d) { return 10 * d.text.length + 10; })
    //   .style("fill", function(d) { return color(d.id / numWords); });
    // node.append("text")
    //   .text(function(d) { return d.text; })
    //   .attr("text-anchor", "middle")
    //   .attr("dominant-baseline", "middle");
    // graph.nodes.forEach(function(d, i) {
    //   d.x = 100 * i;
    //   d.y = 100 * (2 * Math.random() - 1);
    // });
    // forceLink.distance(function(l) {
    //   let r1 = 10 * l.source.text.length + 10;
    //   let r2 = 10 * l.target.text.length + 10;
    //   return 1.5 * (r1 + r2);
    // });
    // forceManyBody.strength(function(d) {
    //   return -5 * d.text.length;
    // });
    // forceX.strength(0.001);
    // forceY.strength(0.004);
    // simulation
    //   .nodes(graph.nodes);
    // simulation.force("link")
    //   .links(graph.links);
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

    forceLink.distance(50);
    forceManyBody.strength(function(d) {
      return -(20**scale);
    });
    forceX.strength(0.04);
    forceY.strength(0.04);

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
