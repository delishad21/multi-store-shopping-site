function fmtMoney(n) {
  if (n === null || n === undefined || isNaN(n)) return "";
  return "S$" + Number(n).toFixed(2);
}

function ensureSheet(ss, name) {
  var sh = ss.getSheetByName(name);
  return sh || ss.insertSheet(name);
}

function getHeaderMap(sheet) {
  var lastCol = sheet.getLastColumn() || 1;
  var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var map = new Map();
  for (var i = 0; i < header.length; i++) {
    var key = String(header[i] || "").trim();
    map.set(key, i + 1); // 1-based
  }
  return { header: header, map: map };
}

function ensureColumn(sheet, headerMap, title) {
  title = String(title);
  if (headerMap.map.has(title)) return headerMap.map.get(title);
  var colIndex = headerMap.header.length + 1;
  sheet.getRange(1, colIndex).setValue(title);
  headerMap.header.push(title);
  headerMap.map.set(title, colIndex);
  return colIndex;
}

function setCell(sheet, row, col, value) {
  sheet.getRange(row, col).setValue(value);
}

function nl(items) {
  var out = [];
  for (var i = 0; i < items.length; i++) {
    if (items[i]) out.push(items[i]);
  }
  return out.join("\n");
}

function makeItemsBlock(items) {
  if (!Array.isArray(items)) return "";
  var byStore = {};
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var store = it && it.storeName ? it.storeName : "Store";
    if (!byStore[store]) byStore[store] = [];
    byStore[store].push(it);
  }

  var storeNames = Object.keys(byStore).sort();
  var blocks = [];
  for (var s = 0; s < storeNames.length; s++) {
    var name = storeNames[s];
    var list = byStore[name];
    var lines = [];
    for (var j = 0; j < list.length; j++) {
      var it2 = list[j];
      var qty = it2 && it2.qty != null ? it2.qty : 0;
      var up = it2 && it2.unitPrice != null ? it2.unitPrice : 0;
      var lt = it2 && it2.lineTotal != null ? it2.lineTotal : qty * up;
      lines.push(
        "• " +
          it2.name +
          " x " +
          qty +
          " @ " +
          fmtMoney(up) +
          " = " +
          fmtMoney(lt)
      );
    }
    blocks.push(name + "\n" + nl(lines));
  }
  return nl(blocks);
}

function findItemLabelFromSku(sku, items) {
  if (!sku || !Array.isArray(items)) return sku || "";
  var found = null;
  for (var i = 0; i < items.length; i++) {
    if (items[i].sku === sku) {
      found = items[i];
      break;
    }
  }
  if (!found) return sku;
  var qty = found.qty != null ? found.qty : 0;
  var lt =
    found.lineTotal != null
      ? found.lineTotal
      : (found.unitPrice != null ? found.unitPrice : 0) * qty;
  var store = found.storeName ? found.storeName : "Store";
  return store + " — " + found.name + " x " + qty + " = " + fmtMoney(lt);
}

function doPost(e) {
  try {
    var raw =
      e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    var data = JSON.parse(raw);

    // TODO: put your Google Sheet ID here
    var ss = SpreadsheetApp.openById("GOOGLE SHEET ID");
    var sheet = ensureSheet(ss, "Orders");

    // Ensure base headers
    var hm = getHeaderMap(sheet);
    var colTimestamp = ensureColumn(sheet, hm, "Timestamp");
    var colName = ensureColumn(sheet, hm, "Name");
    var colClass = ensureColumn(sheet, hm, "Class");
    var colGrandTotal = ensureColumn(sheet, hm, "Grand Total");
    var colItemsPretty = ensureColumn(sheet, hm, "Items");

    // Justifications columns (up to 3)
    var JN = 3;
    var jCols = [];
    for (var k = 1; k <= JN; k++) {
      var c1 = ensureColumn(sheet, hm, "Justify " + k + " — Item");
      var c2 = ensureColumn(sheet, hm, "Justify " + k + " — Reason");
      jCols.push([c1, c2]);
    }

    // Per-store totals columns (dynamic)
    var perStoreTotals = Array.isArray(data.perStoreTotals)
      ? data.perStoreTotals
      : [];
    var storeCols = {}; // storeName -> [subtotal, discount, shipping, total]
    for (var p = 0; p < perStoreTotals.length; p++) {
      var s = perStoreTotals[p];
      var storeName = s.storeName
        ? s.storeName
        : s.storeId
        ? s.storeId
        : "Store";
      if (storeCols[storeName]) continue;
      var cs1 = ensureColumn(
        sheet,
        hm,
        storeName + " — Subtotal (before discount)"
      );
      var cs2 = ensureColumn(sheet, hm, storeName + " — Discount");
      var cs3 = ensureColumn(sheet, hm, storeName + " — Shipping");
      var cs4 = ensureColumn(sheet, hm, storeName + " — Store Total");
      storeCols[storeName] = [cs1, cs2, cs3, cs4];
    }

    // Write row
    var row = sheet.getLastRow() + 1;

    setCell(sheet, row, colTimestamp, new Date());
    setCell(sheet, row, colName, data.name || "");
    setCell(sheet, row, colClass, data.className || "");
    setCell(
      sheet,
      row,
      colGrandTotal,
      fmtMoney(data.grandTotal != null ? data.grandTotal : 0)
    );
    setCell(
      sheet,
      row,
      colItemsPretty,
      makeItemsBlock(Array.isArray(data.items) ? data.items : [])
    );

    // Justifications
    var justs = Array.isArray(data.justifications) ? data.justifications : [];
    for (var i = 0; i < JN; i++) {
      var pair = jCols[i];
      if (!pair) break;
      var j = justs[i];
      if (!j) {
        setCell(sheet, row, pair[0], "");
        setCell(sheet, row, pair[1], "");
      } else {
        var label = findItemLabelFromSku(
          j.sku,
          Array.isArray(data.items) ? data.items : []
        );
        setCell(sheet, row, pair[0], label);
        setCell(sheet, row, pair[1], j.text || "");
      }
    }

    // Per-store totals
    for (var t = 0; t < perStoreTotals.length; t++) {
      var st = perStoreTotals[t];
      var nm = st.storeName ? st.storeName : st.storeId ? st.storeId : "Store";
      var cols = storeCols[nm];
      if (!cols) continue;
      setCell(
        sheet,
        row,
        cols[0],
        fmtMoney(st.itemsSubtotal != null ? st.itemsSubtotal : 0)
      );
      setCell(
        sheet,
        row,
        cols[1],
        fmtMoney(st.itemsDiscount != null ? st.itemsDiscount : 0)
      );
      setCell(
        sheet,
        row,
        cols[2],
        fmtMoney(st.shippingNet != null ? st.shippingNet : 0)
      );
      setCell(
        sheet,
        row,
        cols[3],
        fmtMoney(st.storeTotal != null ? st.storeTotal : 0)
      );
    }

    // Wrap the big items cell for readability
    sheet.getRange(row, colItemsPretty).setWrap(true);

    return ContentService.createTextOutput(
      JSON.stringify({ ok: true })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: String(err) })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
