function extract_graph(synsets, query, max_synsets) {
    var re = new RegExp(query, "i");
    var count_synsets = 0;
    var graph = { nodes: [], links: [] };
    for (var i = 0; i < synsets.length; ++i) {
        var synset = synsets[i];
        var matched = synset.words.some(function(w) { return re.exec(w); });
        if (matched) {
            count_synsets += 1;
            var synset_node = {
                id: "synset:" + i,
                synset_id: i,
                gloss: synset.gloss
            };
            var word_nodes = synset.words.map(function(w) {
                return {
                    id: w,
                    word: w
                };
            });
            var links = word_nodes.map(function(n) {
                return {
                    id: "link:" + synset_node.id + ":" + n.id,
                    source: synset_node,
                    target: n
                };
            });
            graph.nodes = graph.nodes.concat(synset_node, word_nodes);
            graph.links = graph.links.concat(links);
            if (count_synsets == max_synsets) {
                break;
            }
        }
    }
    return graph;
}

$(function() {
    "use strict";

    var color = d3.scale.category20();
    var force = d3.layout.force()
        .charge(-400)
        .linkDistance(100)
        .size([$(window).innerWidth(), $(window).innerHeight()]);
    $(window).on('resize', function() {
        force.size([$('svg').width(), $('svg').height()]);
    });
    var scrollX = 0;
    var scrollY = 0;
    var svg = d3.select("body svg");

    function update(graph) {
        force
            .nodes(graph.nodes)
            .links(graph.links)
            .start();
        var link = svg.selectAll(".link")
            .data(graph.links);
        link
            .enter().append("line")
            .attr("class", "link");
        link
            .exit().remove();

        var node = svg.selectAll(".node")
            .data(graph.nodes);
        node
            .enter().append("g")
            .attr("class", "node");
        node
            .exit().remove();

        node.selectAll("*").remove();
        node.append("circle")
            .attr("r", function(d) { return d.word ? 5 : 10; })
            .style("fill", function(d) { return d.word ? "gray" : color(d.synset_id); });
        node.append("text")
            .text(function(d) { return d.word || ""; });

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
        $("svg").on("mousedown", function(e) {
            if (e.which === 1) {
                grab = {
                    pageX: e.pageX,
                    pageY: e.pageY,
                    scrollX: scrollX,
                    scrollY: scrollY
                };
            }
        });
        $("svg").on("mousemove", function(e) {
            if (e.which === 1 && grab) {
                scrollX = grab.scrollX + (e.pageX - grab.pageX);
                scrollY = grab.scrollY + (e.pageY - grab.pageY);
                update_position();
            }
        });
        $("svg").on("mouseup", function(e) {
            if (e.which === 1) {
                grab = null;
            }
        });
    }

    var synsets = null;
    d3.json("test.json", function(error, data) {
        synsets = data;

        var graph = extract_graph(synsets, "", 100);

        update(graph);
    });

    $("#query").on("keypress", function(e) {
        var query = $(this).val();
        var graph = extract_graph(synsets, query, 100);
        update(graph);
    });
});
