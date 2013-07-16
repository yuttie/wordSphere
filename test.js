function reconstruct_links(graph) {
    $.each(graph.nodes, function(i, node) {
        node.index = i;
    });
    $.each(graph.links, function(i, link) {
        link.source = graph.nodes[typeof(link.source) === "number" ? link.source : link.source.index];
        link.target = graph.nodes[typeof(link.target) === "number" ? link.target : link.target.index];
    });
}

function index_words(graph) {
    var indices = {};
    $.each(graph.nodes, function(i, n) { indices[n.word] = i; });
    return indices;
}

function calculate_neighbors(graph) {
    var neighbors = [];
    $.each(graph.links, function(i, link) {
        neighbors[link.source.index] = neighbors[link.source.index] || [];
        neighbors[link.target.index] = neighbors[link.target.index] || [];

        neighbors[link.source.index].push(link.target.index);
        neighbors[link.target.index].push(link.source.index);
    });
    return neighbors;
}

function extract_words(graph) {
    var words = [];
    $.each(graph.nodes, function(i, n) {
        if (n.word) {
            words.push(n.word);
        }
    });
    return words;
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

    var graph_original = null;
    var word_indices = null;
    var neighbors = null;
    var words = null;
    function narrow_graph_by_words(graph, words) {
        var to_be_shown = {};
        var stack = words.map(function(w) { return word_indices[w]; });
        while (stack.length > 0) {
            var ni = stack.pop();
            to_be_shown[ni] = true;
            $.each(neighbors[ni], function(i, nni) {
                if (!to_be_shown[nni]) {
                    stack.push(nni);
                }
            });
        }

        return {
            links: graph.links.filter(function(l) { return to_be_shown[l.source.index] || to_be_shown[l.target.index]; }),
            nodes: graph.nodes.filter(function(n) { return to_be_shown[n.index]; })
        };
    }

    function narrow_graph_randomly(graph, p) {
        var to_be_shown = graph.nodes.map(function(n) { return !n.word && Math.random() < p; });
        $.each(graph.nodes, function(i, n) {
            if (!n.word && to_be_shown[i]) {
                $.each(neighbors[i], function(_, j) {
                    to_be_shown[j] = true;
                });
            }
        });

        return {
            links: graph.links.filter(function(l) { return to_be_shown[l.source.index] && to_be_shown[l.target.index]; }),
            nodes: graph.nodes.filter(function(n) { return to_be_shown[n.index]; })
        };
    }

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

    d3.json("test.json", function(error, graph) {
        graph_original = graph;
        reconstruct_links(graph_original);
        word_indices = index_words(graph_original);
        neighbors = calculate_neighbors(graph_original);
        words = extract_words(graph_original);

        graph = $.extend(true, {}, graph_original);
        reconstruct_links(graph);

        while (graph.nodes.length > 500) {
            graph = narrow_graph_randomly(graph, 0.8);
        }
        update(graph);
    });

    $("#query").on("input", function(e) {
        var graph = $.extend(true, {}, graph_original);
        reconstruct_links(graph);

        var q = $(this).val();
        var re = new RegExp(q, "i");
        var matching_words = words.filter(function(w) { return re.exec(w); });

        graph = narrow_graph_by_words(graph, matching_words);
        while (graph.nodes.length > 500) {
            graph = narrow_graph_randomly(graph, 0.8);
        }
        update(graph);
    });
});
