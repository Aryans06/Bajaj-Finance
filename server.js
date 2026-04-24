const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ─── Identity Config (UPDATE THESE) ──────────────────────────────────────────
const USER_ID = "aryan_24042006"; // fullname_ddmmyyyy
const EMAIL_ID = "aryan@college.edu"; // your college email
const ROLL_NUMBER = "21CS1001"; // your roll number

// ─── Validation ──────────────────────────────────────────────────────────────
const EDGE_REGEX = /^[A-Z]->[A-Z]$/;

function validateEntry(raw) {
  if (typeof raw !== "string") return { valid: false, original: String(raw) };
  const trimmed = raw.trim();
  if (!EDGE_REGEX.test(trimmed)) return { valid: false, original: raw };
  const [parent, child] = trimmed.split("->");
  if (parent === child) return { valid: false, original: raw }; // self-loop
  return { valid: true, parent, child, edge: `${parent}->${child}`, original: raw };
}

// ─── Core Processing ─────────────────────────────────────────────────────────
function processData(data) {
  const invalidEntries = [];
  const duplicateEdgesSet = new Set();
  const seenEdges = new Set();
  const validEdges = []; // ordered list of { parent, child }

  // 1. Validate & deduplicate
  for (const entry of data) {
    const result = validateEntry(entry);
    if (!result.valid) {
      invalidEntries.push(result.original);
      continue;
    }
    if (seenEdges.has(result.edge)) {
      duplicateEdgesSet.add(result.edge);
      continue;
    }
    seenEdges.add(result.edge);
    validEdges.push({ parent: result.parent, child: result.child });
  }

  // 2. Multi-parent resolution — first parent wins
  const childToParent = new Map(); // child -> parent
  const effectiveEdges = [];
  for (const { parent, child } of validEdges) {
    if (childToParent.has(child)) {
      // silently discard — child already has a parent
      continue;
    }
    childToParent.set(child, parent);
    effectiveEdges.push({ parent, child });
  }

  // 3. Build adjacency list (directed) and collect all nodes
  const adjList = new Map(); // parent -> [children]
  const allNodes = new Set();
  for (const { parent, child } of effectiveEdges) {
    allNodes.add(parent);
    allNodes.add(child);
    if (!adjList.has(parent)) adjList.set(parent, []);
    adjList.get(parent).push(child);
  }

  // 4. Find connected components (undirected)
  const undirected = new Map();
  for (const node of allNodes) {
    undirected.set(node, []);
  }
  for (const { parent, child } of effectiveEdges) {
    undirected.get(parent).push(child);
    undirected.get(child).push(parent);
  }

  const visited = new Set();
  const components = [];

  for (const node of [...allNodes].sort()) {
    if (visited.has(node)) continue;
    const component = [];
    const queue = [node];
    visited.add(node);
    while (queue.length > 0) {
      const current = queue.shift();
      component.push(current);
      for (const neighbor of undirected.get(current) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    components.push(component.sort());
  }

  // 5. Process each component
  const hierarchies = [];
  const childSet = new Set(childToParent.keys());

  for (const component of components) {
    const componentSet = new Set(component);

    // Find root: node that never appears as a child
    let roots = component.filter((n) => !childSet.has(n));

    let root;
    let isPureCycle = false;
    if (roots.length === 0) {
      // Pure cycle — all nodes are children
      isPureCycle = true;
      root = component[0]; // already sorted, so lexicographically smallest
    } else {
      root = roots.sort()[0]; // lexicographically smallest root
    }

    // Cycle detection via DFS
    const hasCycle = detectCycle(root, adjList, componentSet);

    if (hasCycle || isPureCycle) {
      hierarchies.push({
        root,
        tree: {},
        has_cycle: true,
      });
    } else {
      const tree = buildTree(root, adjList);
      const depth = calculateDepth(tree);
      hierarchies.push({
        root,
        tree,
        depth,
      });
    }
  }

  // 6. Build summary
  const trees = hierarchies.filter((h) => !h.has_cycle);
  const cycles = hierarchies.filter((h) => h.has_cycle);

  let largestTreeRoot = "";
  let maxDepth = 0;
  for (const t of trees) {
    if (
      t.depth > maxDepth ||
      (t.depth === maxDepth && t.root < largestTreeRoot)
    ) {
      maxDepth = t.depth;
      largestTreeRoot = t.root;
    }
  }

  return {
    user_id: USER_ID,
    email_id: EMAIL_ID,
    college_roll_number: ROLL_NUMBER,
    hierarchies,
    invalid_entries: invalidEntries,
    duplicate_edges: [...duplicateEdgesSet],
    summary: {
      total_trees: trees.length,
      total_cycles: cycles.length,
      largest_tree_root: largestTreeRoot,
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectCycle(startNode, adjList, componentSet) {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  for (const node of componentSet) color.set(node, WHITE);

  function dfs(node) {
    color.set(node, GRAY);
    for (const child of adjList.get(node) || []) {
      if (!componentSet.has(child)) continue;
      if (color.get(child) === GRAY) return true; // back edge = cycle
      if (color.get(child) === WHITE && dfs(child)) return true;
    }
    color.set(node, BLACK);
    return false;
  }

  // Run DFS from all nodes in case graph is disconnected within component
  for (const node of componentSet) {
    if (color.get(node) === WHITE) {
      if (dfs(node)) return true;
    }
  }
  return false;
}

function buildTree(root, adjList) {
  const result = {};
  const children = adjList.get(root) || [];
  const subtree = {};
  for (const child of children) {
    const childTree = buildTree(child, adjList);
    Object.assign(subtree, childTree);
  }
  result[root] = subtree;
  return result;
}

function calculateDepth(tree) {
  const keys = Object.keys(tree);
  if (keys.length === 0) return 0;
  const root = keys[0];
  const children = tree[root];
  const childKeys = Object.keys(children);
  if (childKeys.length === 0) return 1;
  let maxChildDepth = 0;
  for (const childKey of childKeys) {
    const childSubtree = {};
    childSubtree[childKey] = children[childKey];
    const d = calculateDepth(childSubtree);
    if (d > maxChildDepth) maxChildDepth = d;
  }
  return 1 + maxChildDepth;
}

// ─── Routes ──────────────────────────────────────────────────────────────────
app.post("/bfhl", (req, res) => {
  try {
    const { data } = req.body;
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: "Invalid request. 'data' must be an array." });
    }
    const result = processData(data);
    return res.json(result);
  } catch (err) {
    console.error("Processing error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/bfhl", (req, res) => {
  res.json({ operation_code: 1 });
});

// Serve frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 BFHL API running at http://localhost:${PORT}`);
});
