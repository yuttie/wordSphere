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

    function getSvgSize() {
        var width = parseInt(d3.select("svg").style("width"));
        var height = parseInt(d3.select("svg").style("height"));
        return [width, height];
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

    var color = d3.scale.category20();
    var force = d3.layout.force()
        .charge(-200)
        .size(getSvgSize());
    window.addEventListener("resize", function() {
        force.size(getSvgSize());
        force.resume();
    });

    var scrollX = 0;
    var scrollY = 0;
    var svg = d3.select("body svg");

    function update(graph) {
        force
            .linkDistance(50)
            .nodes(graph.nodes)
            .links(graph.links)
            .start();
        var link = svg.selectAll(".link")
            .data(graph.links, function(d) { return d.id; });
        link
            .enter().append("line")
            .attr("class", "link");
        link
            .exit().remove();

        var node = svg.selectAll(".node")
            .data(graph.nodes, function(d) { return d.id; });
        node
            .enter().append("g")
            .attr("class", "node")
            .call(force.drag)
            .call(function(n) {
                n.on("mousedown", function() { d3.event.stopPropagation(); });
                n.on("touchstart", function() { d3.event.stopPropagation(); }); });
        node
            .exit().remove();

        node.selectAll("*").remove();
        node.append("circle")
            .attr("r", function(d) { return d.word ? 5 : 10; })
            .style("fill", function(d) { return d.word ? "gray" : color(d.synset_id); });
        node.filter(function(d) { return d.gloss; }).append("title")
            .text(function(d) { return d.gloss; });
        node.filter(function(d) { return d.word; }).append("text")
            .text(function(d) { return d.word; })
            .attr("transform", "translate(8, 4)")
            .classed("non-matched", function(d) { return !d.matched; });

        node = svg.selectAll(".node");
        link = svg.selectAll(".link");

        function update_position() {
            link.attr("x1", function(d) { return scrollX + d.source.x; })
                .attr("y1", function(d) { return scrollY + d.source.y; })
                .attr("x2", function(d) { return scrollX + d.target.x; })
                .attr("y2", function(d) { return scrollY + d.target.y; });

            node.attr("transform", function(d) { return "translate(" + (scrollX + d.x) + ", " + (scrollY + d.y) + ")"; });
        }
        force.on("tick", update_position);

        var grab = null;
        d3.select("svg").on("mousedown", function() {
            if (d3.event.which === 1) {
                grab = {
                    pageX: d3.event.pageX,
                    pageY: d3.event.pageY,
                    scrollX: scrollX,
                    scrollY: scrollY
                };
            }
        });
        d3.select("svg").on("mousemove", function() {
            if (d3.event.which === 1 && grab) {
                scrollX = grab.scrollX + (d3.event.pageX - grab.pageX);
                scrollY = grab.scrollY + (d3.event.pageY - grab.pageY);
                update_position();
            }
        });
        d3.select("svg").on("mouseup", function() {
            if (d3.event.which === 1) {
                grab = null;
            }
        });
        // for touch devices
        d3.select("svg").on("touchstart", function() {
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
        d3.select("svg").on("touchmove", function() {
            d3.event.preventDefault();
            if (grab) {
                for (var i = 0; i < d3.event.changedTouches.length; ++i) {
                    var t = d3.event.changedTouches[i];
                    if (t.identifier === grab.tid) {
                        scrollX = grab.scrollX + (t.pageX - grab.pageX);
                        scrollY = grab.scrollY + (t.pageY - grab.pageY);
                        update_position();
                        break;
                    }
                }
            }
        });
        d3.select("svg").on("touchend", function() {
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

        var link = svg.selectAll(".link")
            .data(graph.links);
        link
            .enter().append("line")
            .attr("class", "link");
        link
            .exit().remove();

        var node = svg.selectAll(".node")
            .data(graph.nodes, function(d) { return d.id; });
        node
            .enter().append("g")
            .attr("class", "node");
        node
            .exit().remove();

        node.selectAll("*").remove();
        node.append("circle")
            .attr("r", function(d) { return 10 * d.text.length; })
            .style("fill", function(d) { return color(d.id); });
        node.append("text")
            .text(function(d) { return d.text; })
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle");

        force.linkDistance(100);
        force.nodes(graph.nodes).links(graph.links).start();
        force.on("tick", function() {
            // change the velocity (apply a force to it)
            graph.nodes.forEach(function(d) {
                var vx = (d.x - d.px);
                var ax = 0.5 * (d.index - (graph.nodes.length - 1) / 2);
                vx = vx + ax;
                d.px = d.x - vx;
            });
            link.attr("x1", function(d) { return d.source.x; })
                .attr("y1", function(d) { return d.source.y; })
                .attr("x2", function(d) { return d.target.x; })
                .attr("y2", function(d) { return d.target.y; });

            node.attr("transform", function(d) { return "translate(" + d.x + ", " + d.y + ")"; });
            force.resume();
        });
    }

    var synsets = null;
    showMessage("Now Loading . . .");
    var xhr = d3.json(data_name);
    xhr.on("progress", function() {
        var pe = d3.event;
        if (pe.lengthComputable) {
            console.log(pe.loaded, pe.total);
        }
        else {
            console.log(pe.loaded);
        }
    });
    xhr.get(function(error, data) {
        if (error) {
            showMessage(error.status + " " + error.statusText);
        }
        else {
            synsets = data;

            var r = extract_graph(synsets, "", limit);
            if (r.num_synsets_checked < synsets.length) {
                d3.select("#message").text(`(+${limit} synsets found)`);
            }
            else {
                d3.select("#message").text("(" + r.num_synsets_matched + " synsets found)");
            }
            update(r.graph);
        }
    });

    document.addEventListener("keydown", function() {
        d3.select("#query")[0][0].focus();
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
            force.charge(Math.min(force.charge() + 50, 0));
        }
        else if (delta < 0) {
            force.charge(force.charge() - 50);
        }
        force.start();
    }
    document.addEventListener("wheel", on_wheel);
    document.addEventListener("mousewheel", on_wheel);
    document.addEventListener("DOMMouseScroll", on_wheel);
})();
