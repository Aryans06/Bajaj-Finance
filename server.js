const express = require("express");
const cors = require("cors");
const path = require("path");

let app = express();
let PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const MY_ID = "aryanjha_06032004";
const MY_EMAIL = "aj6699@srmist.edu.in";
const MY_ROLL = "RA2211003012345"; 

function isValidEdge(str) {
  if (typeof str !== "string") return null;
  let s = str.trim();
  if (!/^[A-Z]->[A-Z]$/.test(s)) return null;
  let p = s.split("->");
  if (p[0] === p[1]) return null; 
  return { from: p[0], to: p[1], key: s };
}

app.post("/bfhl", (req, res) => {
  try {
    let { data } = req.body;
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: "data must be an array" });
    }

    let invalid = [];
    let dupSet = new Set();
    let seen = new Set();
    let goodEdges = [];

    // go through each input, check if valid, check for dups
    for (let i = 0; i < data.length; i++) {
      let result = isValidEdge(data[i]);
      if (result === null) {
        invalid.push(data[i]);
        continue;
      }
      if (seen.has(result.key)) {
        dupSet.add(result.key);
        continue;
      }
      seen.add(result.key);
      goodEdges.push(result);
    }

    // multi parent handling - first parent wins for each child
    let parentOf = {};
    let finalEdges = [];
    for (let e of goodEdges) {
      if (parentOf[e.to] !== undefined) continue; // already has parent, skip
      parentOf[e.to] = e.from;
      finalEdges.push(e);
    }

    // build adjacency list and track which nodes we saw first
    let adj = {};
    let nodesSeen = [];
    let nodesSet = {};

    for (let e of finalEdges) {
      if (!adj[e.from]) adj[e.from] = [];
      adj[e.from].push(e.to);

      if (!nodesSet[e.from]) { nodesSet[e.from] = true; nodesSeen.push(e.from); }
      if (!nodesSet[e.to]) { nodesSet[e.to] = true; nodesSeen.push(e.to); }
    }

    // find connected components using bfs (treat edges as undirected)
    let undAdj = {};
    for (let n of nodesSeen) undAdj[n] = [];
    for (let e of finalEdges) {
      undAdj[e.from].push(e.to);
      undAdj[e.to].push(e.from);
    }

    let visited = {};
    let groups = [];
    for (let n of nodesSeen) {
      if (visited[n]) continue;
      let group = [];
      let q = [n];
      visited[n] = true;
      while (q.length) {
        let cur = q.shift();
        group.push(cur);
        for (let nb of (undAdj[cur] || [])) {
          if (!visited[nb]) {
            visited[nb] = true;
            q.push(nb);
          }
        }
      }
      group.sort();
      groups.push(group);
    }

    // figure out which nodes are children (they have a parent)
    let isChild = {};
    for (let k in parentOf) isChild[k] = true;

    let hierarchies = [];

    for (let group of groups) {
      // find root = node thats not a child of anything
      let possibleRoots = group.filter(n => !isChild[n]);
      possibleRoots.sort();

      let root, isPureCycle = false;
      if (possibleRoots.length === 0) {
        isPureCycle = true;
        root = group[0]; // group is sorted so this is lex smallest
      } else {
        root = possibleRoots[0];
      }

      // check for cycles using dfs coloring
      let hasCycle = false;
      let colors = {};
      for (let n of group) colors[n] = 0;

      function dfsCheck(node) {
        colors[node] = 1; // in progress
        let kids = adj[node] || [];
        for (let kid of kids) {
          if (colors[kid] === undefined) continue; // not in this group
          if (colors[kid] === 1) return true; // back edge = cycle!
          if (colors[kid] === 0 && dfsCheck(kid)) return true;
        }
        colors[node] = 2; // done
        return false;
      }

      for (let n of group) {
        if (colors[n] === 0) {
          if (dfsCheck(n)) { hasCycle = true; break; }
        }
      }

      if (hasCycle || isPureCycle) {
        hierarchies.push({ root: root, tree: {}, has_cycle: true });
      } else {
        let tree = makeTree(root, adj);
        let depth = calcDepth(root, adj);
        hierarchies.push({ root: root, tree: tree, depth: depth });
      }
    }

    // build summary
    let treeCount = 0, cycleCount = 0;
    let biggestRoot = "", biggestDepth = 0;

    for (let h of hierarchies) {
      if (h.has_cycle) {
        cycleCount++;
      } else {
        treeCount++;
        if (h.depth > biggestDepth || (h.depth === biggestDepth && h.root < biggestRoot)) {
          biggestDepth = h.depth;
          biggestRoot = h.root;
        }
      }
    }

    res.json({
      user_id: MY_ID,
      email_id: MY_EMAIL,
      college_roll_number: MY_ROLL,
      hierarchies: hierarchies,
      invalid_entries: invalid,
      duplicate_edges: Array.from(dupSet),
      summary: {
        total_trees: treeCount,
        total_cycles: cycleCount,
        largest_tree_root: biggestRoot
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "something went wrong" });
  }
});

function makeTree(node, adj) {
  let kids = adj[node] || [];
  let obj = {};
  for (let k of kids) {
    let sub = makeTree(k, adj);
    obj[k] = sub[k];
  }
  let result = {};
  result[node] = obj;
  return result;
}

function calcDepth(node, adj) {
  let kids = adj[node] || [];
  if (kids.length === 0) return 1;
  let mx = 0;
  for (let k of kids) {
    let d = calcDepth(k, adj);
    if (d > mx) mx = d;
  }
  return mx + 1;
}

app.get("/bfhl", (req, res) => {
  res.json({ operation_code: 1 });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

if (require.main === module) {
  app.listen(PORT, () => console.log("running on " + PORT));
}

module.exports = app;
