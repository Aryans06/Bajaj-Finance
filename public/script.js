let url = window.location.origin + "/bfhl";

let exampleData = [
  "A->B","A->C","B->D","C->E","E->F",
  "X->Y","Y->Z","Z->X",
  "P->Q","Q->R",
  "G->H","G->H","G->I",
  "hello","1->2","A->"
];

document.getElementById("go").onclick = doSubmit;
document.getElementById("clr").onclick = function() {
  document.getElementById("inp").value = "";
  document.getElementById("out").style.display = "none";
  document.getElementById("err").style.display = "none";
};
document.getElementById("ex").onclick = function() {
  document.getElementById("inp").value = JSON.stringify(exampleData, null, 2);
};

function doSubmit() {
  let raw = document.getElementById("inp").value.trim();
  if (!raw) { showErr("Enter something first"); return; }

  let arr;
  if (raw.startsWith("[")) {
    try { arr = JSON.parse(raw); } catch(e) { arr = null; }
  }
  if (!arr) {
    arr = raw.split(",").map(function(s) { return s.trim(); }).filter(function(s) { return s; });
  }

  document.getElementById("err").style.display = "none";
  document.getElementById("out").style.display = "none";
  document.getElementById("loading").style.display = "block";

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: arr })
  })
  .then(function(r) {
    if (!r.ok) throw new Error("Server error " + r.status);
    return r.json();
  })
  .then(function(data) {
    showResults(data);
  })
  .catch(function(e) {
    showErr(e.message);
  })
  .finally(function() {
    document.getElementById("loading").style.display = "none";
  });
}

function showErr(msg) {
  let el = document.getElementById("err");
  el.textContent = msg;
  el.style.display = "block";
}

function showResults(d) {
  document.getElementById("vt").textContent = d.summary.total_trees;
  document.getElementById("vc").textContent = d.summary.total_cycles;
  document.getElementById("vr").textContent = d.summary.largest_tree_root || "-";

  let maxD = 0;
  for (let i = 0; i < d.hierarchies.length; i++) {
    if (!d.hierarchies[i].has_cycle && d.hierarchies[i].depth > maxD)
      maxD = d.hierarchies[i].depth;
  }
  document.getElementById("vd").textContent = maxD || "-";

  document.getElementById("mu").textContent = d.user_id;
  document.getElementById("me").textContent = d.email_id;
  document.getElementById("mr").textContent = d.college_roll_number;

  // hierarchy cards
  let container = document.getElementById("cards");
  container.innerHTML = "";

  for (let i = 0; i < d.hierarchies.length; i++) {
    let h = d.hierarchies[i];
    let div = document.createElement("div");
    div.className = "card";

    let badges = "";
    if (h.has_cycle) {
      badges = '<span class="badge badge-c">CYCLE</span>';
    } else {
      badges = '<span class="badge badge-t">TREE</span><span class="badge badge-d">D:' + h.depth + '</span>';
    }

    let body = "";
    if (h.has_cycle) {
      body = '<span style="color:#f87171">Cycle detected</span>';
    } else {
      body = drawTree(h.tree);
    }

    div.innerHTML = '<div class="card-top"><b>' + h.root + '</b><div>' + badges + '</div></div><div class="card-body">' + body + '</div>';
    container.appendChild(div);
  }

  // invalid entries
  let invW = document.getElementById("inv-wrap");
  let invEl = document.getElementById("inv");
  if (d.invalid_entries.length > 0) {
    invW.style.display = "block";
    invEl.innerHTML = "";
    for (let i = 0; i < d.invalid_entries.length; i++) {
      let sp = document.createElement("span");
      sp.className = "chip";
      sp.textContent = d.invalid_entries[i] || '""';
      invEl.appendChild(sp);
    }
  } else { invW.style.display = "none"; }

  // duplicates
  let dupW = document.getElementById("dup-wrap");
  let dupEl = document.getElementById("dup");
  if (d.duplicate_edges.length > 0) {
    dupW.style.display = "block";
    dupEl.innerHTML = "";
    for (let i = 0; i < d.duplicate_edges.length; i++) {
      let sp = document.createElement("span");
      sp.className = "chip";
      sp.textContent = d.duplicate_edges[i];
      dupEl.appendChild(sp);
    }
  } else { dupW.style.display = "none"; }

  document.getElementById("json").textContent = JSON.stringify(d, null, 2);
  document.getElementById("out").style.display = "block";
}

function drawTree(obj) {
  let keys = Object.keys(obj);
  if (keys.length === 0) return "";
  let s = "<ul>";
  for (let i = 0; i < keys.length; i++) {
    let k = keys[i];
    s += '<li><span class="nd">' + k + '</span>';
    if (Object.keys(obj[k]).length > 0) s += drawTree(obj[k]);
    s += '</li>';
  }
  return s + "</ul>";
}
