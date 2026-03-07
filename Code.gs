// ============================================================
// Les Délices de Laura — Google Apps Script v2
// Reçoit les données de la PWA (doPost) et les retourne (doGet)
// ID Sheet: 1WfxAHLu9WX_f66scD73w8B9lzXD_QAcArWcbgG4zy-Q
// ============================================================

var SPREADSHEET_ID = '1WfxAHLu9WX_f66scD73w8B9lzXD_QAcArWcbgG4zy-Q';

// ╔══════════════════════════════════════════════════╗
// ║  doPost : reçoit les données depuis la PWA       ║
// ╚══════════════════════════════════════════════════╝
function doPost(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var results = {};

    // ---- 1. VENTES ----
    if (data.ventes && data.ventes.length > 0) {
      var sheetVentes = getOrCreateSheet(ss, 'Ventes', [
        'ID Vente', 'Date', 'Heure', 'Article', 'Quantité', 'Prix Unitaire (€)',
        'Sous-total Article (€)', 'Total Vente (€)', 'Remise (€)',
        'Mode Paiement', 'Montant Donné (€)', 'Rendu (€)'
      ]);
      data.ventes.forEach(function(v) {
        var d = new Date(v.timestamp);
        var dateStr = Utilities.formatDate(d, 'Europe/Paris', 'dd/MM/yyyy');
        var heureStr = Utilities.formatDate(d, 'Europe/Paris', 'HH:mm:ss');
        if (v.items && v.items.length > 0) {
          v.items.forEach(function(item) {
            var pu = parseFloat(item.price) || 0;
            var q  = parseInt(item.quantity) || 1;
            sheetVentes.appendRow([
              v.id, dateStr, heureStr, item.name, q, pu,
              Math.round(pu * q * 100) / 100,
              v.total || 0, v.discount || 0,
              v.paymentMethod || 'Espèces', v.amountGiven || 0, v.change || 0
            ]);
          });
        } else {
          sheetVentes.appendRow([
            v.id, dateStr, heureStr, '(non détaillé)', 1, 0, 0,
            v.total || 0, v.discount || 0, v.paymentMethod || 'Espèces',
            v.amountGiven || 0, v.change || 0
          ]);
        }
      });
      results.ventes = data.ventes.length + ' ventes ajoutées';
    }

    // ---- 2. CATALOGUE ----
    if (data.catalogue && data.catalogue.length > 0) {
      var sheetCat = getOrCreateSheet(ss, 'Catalogue', [
        'ID', 'Nom', 'Prix (€)', 'Catégorie', 'Stock', 'Seuil Alerte', 'Description'
      ]);
      var lastRow = sheetCat.getLastRow();
      if (lastRow > 1) sheetCat.deleteRows(2, lastRow - 1);
      data.catalogue.forEach(function(p) {
        sheetCat.appendRow([p.id, p.name, p.price, p.categoryName || p.categoryId, p.stock || 0, p.alertThreshold || 0, p.description || '']);
      });
      results.catalogue = data.catalogue.length + ' produits mis à jour';
    }

    // ---- 3. DEPENSES ----
    if (data.depenses && data.depenses.length > 0) {
      var sheetDep = getOrCreateSheet(ss, 'Depenses', [
        'ID', 'Date', 'Heure', 'Montant (€)', 'Motif', 'Note'
      ]);
      data.depenses.forEach(function(d) {
        var dt = new Date(d.timestamp);
        sheetDep.appendRow([
          d.id,
          Utilities.formatDate(dt, 'Europe/Paris', 'dd/MM/yyyy'),
          Utilities.formatDate(dt, 'Europe/Paris', 'HH:mm:ss'),
          d.amount || 0, d.reason || '', d.note || ''
        ]);
      });
      results.depenses = data.depenses.length + ' dépenses ajoutées';
    }

    // ---- 4. CLOTURES ----
    if (data.clotures && data.clotures.length > 0) {
      var sheetClot = getOrCreateSheet(ss, 'Clotures', [
        'ID', 'Date Clôture', 'CA Total (€)', 'Nb Ventes', 'Espèces (€)',
        'Carte (€)', 'Total Dépenses (€)', 'Net Caisse (€)', 'Note'
      ]);
      data.clotures.forEach(function(z) {
        sheetClot.appendRow([
          z.id, z.date || '', z.totalRevenue || 0, z.totalSales || 0,
          z.cashTotal || 0, z.cardTotal || 0, z.totalExpenses || 0, z.netCash || 0, z.note || ''
        ]);
      });
      results.clotures = data.clotures.length + ' clôtures ajoutées';
    }

    // ---- X. STOCK HISTORY ----
    if (data.stock_history && data.stock_history.length > 0) {
      var sheetStock = getOrCreateSheet(ss, 'Stock', [
        'Date', 'Heure', 'ID Produit', 'Nom Produit', 'Type Mouvement',
        'Variation', 'Nouveau Stock', 'ID Référence'
      ]);
      data.stock_history.forEach(function(sh) {
        var dt = new Date(sh.timestamp);
        sheetStock.appendRow([
          Utilities.formatDate(dt, 'Europe/Paris', 'dd/MM/yyyy'),
          Utilities.formatDate(dt, 'Europe/Paris', 'HH:mm:ss'),
          sh.productId || '',
          sh.name || '',
          sh.type || 'Inconnu',
          sh.quantityChange || 0,
          sh.newStock !== undefined ? sh.newStock : '',
          sh.referenceId || ''
        ]);
      });
      results.stock_history = data.stock_history.length + ' mouvements de stock ajoutés';
    }

    // ---- 5. COMMANDES (upsert par ID) ----
    if (data.commandes && data.commandes.length > 0) {
      var sheetCmd = getOrCreateSheet(ss, 'Commandes', [
        'ID', 'Type', 'Date Création', 'Nom Client', 'Téléphone',
        'Date Retrait', 'Heure Retrait', 'Début Production',
        'Total (€)', 'Acompte (€)', 'Reste à Payer (€)',
        'Statut', 'Notes', 'Détail Articles'
      ]);
      data.commandes.forEach(function(c) {
        var createdAt = c.createdAt
          ? Utilities.formatDate(new Date(c.createdAt), 'Europe/Paris', 'dd/MM/yyyy HH:mm')
          : '';
        var total = parseFloat(c.totalPrice) || 0;
        var deposit = parseFloat(c.deposit) || 0;
        var row = [
          c.id, c.type || 'Standard', createdAt,
          c.customerName || '', c.customerPhone || '',
          c.pickupDate || '', c.pickupTime || '', c.productionStartDate || '',
          total, deposit, Math.max(0, total - deposit),
          c.status || 'en_attente',
          c.notes || '', c.items || ''
        ];
        // Upsert : chercher la ligne existante avec ce ID
        upsertRow(sheetCmd, c.id, row);
      });
      results.commandes = data.commandes.length + ' commandes mises à jour';
    }

    // ---- 6. DEVIS (upsert par ID) ----
    if (data.devis && data.devis.length > 0) {
      var sheetDevis = getOrCreateSheet(ss, 'Devis', [
        'ID', 'N° Devis', 'Date Création', 'Client', 'Téléphone', 'Email',
        'Date Validité', 'Date Retrait Prévue',
        'Total (€)', 'Remise (€)', 'Net (€)', 'Statut', 'Détail Articles', 'Notes'
      ]);
      data.devis.forEach(function(d) {
        var createdDate = d.createdAt
          ? Utilities.formatDate(new Date(d.createdAt), 'Europe/Paris', 'dd/MM/yyyy HH:mm')
          : '';
        var net = Math.max(0, (d.totalPrice || 0) - (d.discount || 0));
        var row = [
          d.id,
          d.numero || ('DEV-' + (d.year || new Date().getFullYear()) + '-' + String(d.id).padStart(3, '0')),
          createdDate,
          d.customerName || '', d.customerPhone || '', d.customerEmail || '',
          d.validityDate || '', d.pickupDate || '',
          d.totalPrice || 0, d.discount || 0, Math.round(net * 100) / 100,
          d.status || 'brouillon',
          d.items || '', d.notes || ''
        ];
        upsertRow(sheetDevis, d.id, row);
      });
      results.devis = data.devis.length + ' devis mis à jour';
    }

    output.setContent(JSON.stringify({ status: 'success', results: results }));

  } catch(error) {
    output.setContent(JSON.stringify({ status: 'error', message: error.toString() }));
  }

  return output;
}

// ╔══════════════════════════════════════════════════╗
// ║  doGet : retourne les données actives vers PWA   ║
// ╚══════════════════════════════════════════════════╝
function doGet(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  var action = (e && e.parameter && e.parameter.action) || 'status';

  if (action === 'getData') {
    try {
      var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      var result = {};

      // ── Commandes actives (tout sauf récupéré) ──
      var sheetCmd = ss.getSheetByName('Commandes');
      if (sheetCmd && sheetCmd.getLastRow() > 1) {
        var cmdData = sheetCmd.getDataRange().getValues();
        var cmdHeaders = cmdData[0];
        var commandes = [];
        for (var i = 1; i < cmdData.length; i++) {
          var row = cmdData[i];
          var status = String(row[10] || '');
          if (status === 'recupere' || status === 'collected') continue; // skip terminées
          var obj = {};
          cmdHeaders.forEach(function(h, idx) { obj[h] = row[idx]; });
          commandes.push({
            id: row[0], createdAt: row[1],
            customerName: row[2], customerPhone: row[3],
            pickupDate: row[4], pickupTime: row[5], productionStartDate: row[6],
            totalPrice: row[7], deposit: row[8],
            status: row[10], notes: row[11], items: row[12]
          });
        }
        result.commandes = commandes;
      } else {
        result.commandes = [];
      }

      // ── Devis actifs (pas converti, refusé, expiré) ──
      var sheetDev = ss.getSheetByName('Devis');
      if (sheetDev && sheetDev.getLastRow() > 1) {
        var devData = sheetDev.getDataRange().getValues();
        var skipStatuses = ['converti', 'refuse', 'expire'];
        var devis = [];
        for (var j = 1; j < devData.length; j++) {
          var drow = devData[j];
          var dstatus = String(drow[11] || '');
          if (skipStatuses.indexOf(dstatus) !== -1) continue;
          devis.push({
            id: drow[0], numero: drow[1], createdAt: drow[2],
            customerName: drow[3], customerPhone: drow[4], customerEmail: drow[5],
            validityDate: drow[6], pickupDate: drow[7],
            totalPrice: drow[8], discount: drow[9],
            status: drow[11], items: drow[12], notes: drow[13]
          });
        }
        result.devis = devis;
      } else {
        result.devis = [];
      }

      // ── Catalogue (pour synchro des stocks modifiés dans Sheets) ──
      var sheetCat = ss.getSheetByName('Catalogue');
      if (sheetCat && sheetCat.getLastRow() > 1) {
        var catData = sheetCat.getDataRange().getValues();
        var catalogue = [];
        for (var k = 1; k < catData.length; k++) {
          var crow = catData[k];
          catalogue.push({
            id: crow[0],
            name: crow[1],
            price: crow[2],
            categoryName: crow[3],
            stock: crow[4],
            alertThreshold: crow[5],
            description: crow[6]
          });
        }
        result.catalogue = catalogue;
      } else {
        result.catalogue = [];
      }

      var jsonString = JSON.stringify({ 
        status: 'ok', 
        commandes: result.commandes || [],
        devis: result.devis || [],
        catalogue: result.catalogue || []
      });
      
      // JSONP support
      if (e.parameter.callback) {
        output.setMimeType(ContentService.MimeType.JAVASCRIPT);
        output.setContent(e.parameter.callback + '(' + jsonString + ')');
      } else {
        output.setContent(jsonString);
      }
    } catch(err) {
      var errString = JSON.stringify({ status: 'error', message: err.toString() });
      if (e && e.parameter && e.parameter.callback) {
        output.setMimeType(ContentService.MimeType.JAVASCRIPT);
        output.setContent(e.parameter.callback + '(' + errString + ')');
      } else {
        output.setContent(errString);
      }
    }
  } else {
    // Simple ping
    var pingString = JSON.stringify({ status: 'ok', version: '2.0' });
    if (e && e.parameter && e.parameter.callback) {
      output.setMimeType(ContentService.MimeType.JAVASCRIPT);
      output.setContent(e.parameter.callback + '(' + pingString + ')');
    } else {
      output.setContent(pingString);
    }
  }

  return output;
}

// ── Utilitaires ──
function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f9a8d4');
  }
  return sheet;
}

// Upsert : met à jour la ligne si ID trouvé, sinon ajoute
function upsertRow(sheet, id, row) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return;
    }
  }
  sheet.appendRow(row);
}
