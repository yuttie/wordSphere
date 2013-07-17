function extract_graph(synsets, query, max_synsets) {
    var re = new RegExp(query, "i");
    var count_synsets = 0;
    var graph = { nodes: [], links: [] };
    var word_node = {};
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
                if (!word_node[w]) {
                    word_node[w] = {
                        id: w,
                        word: w,
                        matched: !!re.exec(w)
                    };
                    word_nodes.push(word_node[w]);
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

(function() {
    "use strict";

    var color = d3.scale.category20();
    var force = d3.layout.force()
        .charge(-200)
        .linkDistance(50)
        .size(getSvgSize());
    window.onresize = function() {
        force.size(getSvgSize());
        force.resume();
    };

    var scrollX = 0;
    var scrollY = 0;
    var svg = d3.select("body svg");

    function update(graph) {
        force
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
            .call(function(n) { n.on("mousedown", function() { d3.event.stopPropagation(); }); });
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
    }

    var synsets = null;
    d3.json("test.json", function(error, data) {
        synsets = data;

        var r = extract_graph(synsets, "", 50);
        if (r.num_synsets_checked < synsets.length) {
            d3.select("#message").text("(+50 synsets found)");
        }
        else {
            d3.select("#message").text("(" + r.num_synsets_matched + " synsets found)");
        }
        update(r.graph);
    });

    document.onkeydown = function() {
        d3.select("#query")[0][0].focus();
    };

    d3.select("#query").on("input", function() {
        var query = this.value;
        var r = extract_graph(synsets, query, 50);
        if (r.num_synsets_checked < synsets.length) {
            d3.select("#message").text("(+50 synsets found)");
        }
        else {
            d3.select("#message").text("(" + r.num_synsets_matched + " synsets found)");
        }
        update(r.graph);
    });

    function on_wheel(e) {
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
        e.preventDefault();
    }
    document.onwheel = on_wheel;
    document.onmousewheel = on_wheel;
    document.onDOMMouseScroll = on_wheel;
})();
