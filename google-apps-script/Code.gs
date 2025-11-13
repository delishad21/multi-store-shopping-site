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
  var up = found.unitPrice != null ? found.unitPrice : 0;
  var lt = found.lineTotal != null ? found.lineTotal : up * qty;
  var store = found.storeName ? found.storeName : "Store";
  return store + " — " + found.name + " x " + qty + " = " + fmtMoney(lt);
}

function formatAppliedCodes(overall) {
  if (!overall || !Array.isArray(overall.appliedCodes)) return "";
  var lines = [];
  for (var i = 0; i < overall.appliedCodes.length; i++) {
    var c = overall.appliedCodes[i];
    if (!c || !c.code) continue;
    var base;
    if (c.kind === "percent") {
      base = c.code + " — " + c.amount + "% off";
    } else {
      base = c.code + " — " + fmtMoney(c.amount) + " off";
    }
    if (c.description) {
      base += " · " + c.description;
    }
    lines.push(base);
  }
  return nl(lines);
}

// NEW: write a string as plain text (prevents Sheets from truncating/formatting)
function setTextCell(sheet, row, col, value) {
  var rg = sheet.getRange(row, col);
  rg.setNumberFormat("@"); // force "Plain text"
  rg.setValue(value != null ? String(value) : "");
}

function doPost(e) {
  try {
    var raw =
      e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    var data = JSON.parse(raw);

    var ss = SpreadsheetApp.openById(
      "1sGCas09s_VFkmwe7atn2FRfY5VaMsmP6pfUujo_2lkE"
    );
    var sheet = ensureSheet(ss, "Orders");

    // ---- headers: existing ----
    var hm = getHeaderMap(sheet);
    var colTimestamp = ensureColumn(sheet, hm, "Timestamp");
    var colName = ensureColumn(sheet, hm, "Name");
    var colClass = ensureColumn(sheet, hm, "Class");
    var colGrandTotal = ensureColumn(sheet, hm, "Grand Total"); // final (after codes)
    var colItemsPretty = ensureColumn(sheet, hm, "Items");

    // overall discount columns
    var colGrandBefore = ensureColumn(sheet, hm, "Grand Total (before codes)");
    var colGrandAfter = ensureColumn(sheet, hm, "Grand Total (after codes)");
    var colCodesUsed = ensureColumn(sheet, hm, "Discount Codes Used");
    var colDiscFromCd = ensureColumn(sheet, hm, "Discount from Codes");

    // Justifications (up to 3)
    var JN = 3;
    var jCols = [];
    for (var k = 1; k <= JN; k++) {
      var c1 = ensureColumn(sheet, hm, "Justify " + k + " — Item");
      var c2 = ensureColumn(sheet, hm, "Justify " + k + " — Reason");
      jCols.push([c1, c2]);
    }

    // Per-store totals (dynamic)
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

    // ---- Payment columns (added at the back) ----
    var colGiftNum = ensureColumn(sheet, hm, "Gift Card Number");
    var colGiftBefore = ensureColumn(sheet, hm, "Gift Balance (before)");
    var colGiftCharge = ensureColumn(sheet, hm, "Gift Charge Amount");
    var colGiftAfter = ensureColumn(sheet, hm, "Gift Balance (after)");

    // ---- overall discount payload extraction ----
    var overall = data.overallDiscounts || null;

    var grandBeforeCodes =
      overall && typeof overall.grandTotalBeforeDiscounts === "number"
        ? overall.grandTotalBeforeDiscounts
        : data.grandTotal != null
        ? data.grandTotal
        : 0;

    var grandAfterCodes =
      overall && typeof overall.grandTotalAfterDiscounts === "number"
        ? overall.grandTotalAfterDiscounts
        : data.grandTotal != null
        ? data.grandTotal
        : 0;

    var percentAmt =
      overall && typeof overall.percentDiscountAmount === "number"
        ? overall.percentDiscountAmount
        : 0;
    var absoluteAmt =
      overall && typeof overall.absoluteDiscountAmount === "number"
        ? overall.absoluteDiscountAmount
        : 0;
    var discountFromCodes = percentAmt + absoluteAmt;

    var codesUsedStr = formatAppliedCodes(overall);

    // ---- payment payload extraction ----
    var pay = data.paymentInfo || data.payment || null;

    var cardNumber =
      pay && pay.cardNumber != null ? String(pay.cardNumber) : "";
    var holder = pay && pay.holder ? String(pay.holder) : "";

    // Accept either "exp" (e.g. "08/27") or expMonth/expYear
    var exp = pay && pay.cardExp ? String(pay.cardExp) : "";

    // CVV as text
    var cvv = pay && pay.cvv != null ? String(pay.cvv) : "";

    var bal = pay && typeof pay.bal === "number" ? pay.bal : null;

    // ---- write the row ----
    var row = sheet.getLastRow() + 1;

    setCell(sheet, row, colTimestamp, new Date());
    setCell(sheet, row, colName, data.name || "");
    setCell(sheet, row, colClass, data.className || "");

    // Old "Grand Total" column is the final amount (after codes)
    setCell(sheet, row, colGrandTotal, fmtMoney(grandAfterCodes));

    // New overall discount columns
    setCell(sheet, row, colGrandBefore, fmtMoney(grandBeforeCodes));
    setCell(sheet, row, colGrandAfter, fmtMoney(grandAfterCodes));
    setCell(sheet, row, colCodesUsed, codesUsedStr);
    setCell(sheet, row, colDiscFromCd, fmtMoney(discountFromCodes));

    // Items (pretty)
    setCell(
      sheet,
      row,
      colItemsPretty,
      makeItemsBlock(Array.isArray(data.items) ? data.items : [])
    );

    // Justifications
    var justs = Array.isArray(data.justifications) ? data.justifications : [];
    var itemsForJust = Array.isArray(data.items) ? data.items : [];
    for (var i = 0; i < JN; i++) {
      var pair = jCols[i];
      if (!pair) break;
      var j = justs[i];
      if (!j) {
        setCell(sheet, row, pair[0], "");
        setCell(sheet, row, pair[1], "");
      } else {
        var label = findItemLabelFromSku(j.sku, itemsForJust);
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

    // Payment Info
    var pay = data.paymentInfo || null;
    var giftNum = pay && pay.giftCardNumber ? String(pay.giftCardNumber) : "";
    var giftBefore =
      pay && typeof pay.balanceBefore === "number" ? pay.balanceBefore : null;
    var giftCharge =
      pay && typeof pay.chargeAmount === "number" ? pay.chargeAmount : null;
    var giftAfter =
      pay && typeof pay.balanceAfter === "number" ? pay.balanceAfter : null;

    // write the cells
    setCell(sheet, row, colGiftNum, giftNum);
    setCell(sheet, row, colGiftBefore, fmtMoney(giftBefore));
    setCell(sheet, row, colGiftCharge, fmtMoney(giftCharge));
    setCell(sheet, row, colGiftAfter, fmtMoney(giftAfter));

    // Wrap big items cell
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
