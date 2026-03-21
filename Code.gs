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
        // Skip if this sale ID already exists in the sheet
        if (rowExistsWithId(sheetVentes, v.id)) return;
        var ts = v.timestamp ? new Date(v.timestamp) : null;
        var dateStr = ts && !isNaN(ts.getTime()) ? Utilities.formatDate(ts, 'Europe/Paris', 'dd/MM/yyyy') : '';
        var heureStr = ts && !isNaN(ts.getTime()) ? Utilities.formatDate(ts, 'Europe/Paris', 'HH:mm:ss') : '';
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

    // ---- 2. CATALOGUE & ALERTES STOCK ----
    if (data.catalogue && data.catalogue.length > 0) {
      // a. Catalogue complet
      var sheetCat = getOrCreateSheet(ss, 'Catalogue', [
        'ID', 'Nom', 'Prix (€)', 'Catégorie', 'Stock', 'Seuil Alerte', 'Description'
      ]);
      var lastRowCat = sheetCat.getLastRow();
      if (lastRowCat > 1) sheetCat.deleteRows(2, lastRowCat - 1);
      
      // b. Onglet dédié aux alertes (uniquement stock <= seuil)
      var sheetAlerts = getOrCreateSheet(ss, 'Alertes Stock', [
        'ID', 'Nom', 'Stock Actuel', 'Seuil Alerte', 'Catégorie', 'Description'
      ]);
      var lastRowAlerts = sheetAlerts.getLastRow();
      if (lastRowAlerts > 1) sheetAlerts.deleteRows(2, lastRowAlerts - 1);

      data.catalogue.forEach(function(p) {
        // Ajout au catalogue
        sheetCat.appendRow([p.id, p.name, p.price, p.categoryName || p.categoryId, p.stock || 0, p.alertThreshold || 0, p.description || '']);
        
        // Ajout aux alertes si besoin
        var stock = parseInt(p.stock) || 0;
        var threshold = parseInt(p.alertThreshold) || 0;
        if (stock <= threshold) {
          sheetAlerts.appendRow([p.id, p.name, stock, threshold, p.categoryName || p.categoryId, p.description || '']);
        }
      });
      results.catalogue = data.catalogue.length + ' produits mis à jour';
    }

    // ---- 3. DEPENSES ----
    if (data.depenses && data.depenses.length > 0) {
      var sheetDep = getOrCreateSheet(ss, 'Depenses', [
        'ID', 'Date', 'Heure', 'Montant (€)', 'Motif', 'Note'
      ]);
      data.depenses.forEach(function(d) {
        // Skip if this expense ID already exists in the sheet
        if (rowExistsWithId(sheetDep, d.id)) return;
        var dt = d.timestamp ? new Date(d.timestamp) : null;
        sheetDep.appendRow([
          d.id,
          dt && !isNaN(dt.getTime()) ? Utilities.formatDate(dt, 'Europe/Paris', 'dd/MM/yyyy') : '',
          dt && !isNaN(dt.getTime()) ? Utilities.formatDate(dt, 'Europe/Paris', 'HH:mm:ss') : '',
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
        // Skip if this cloture ID already exists in the sheet
        if (rowExistsWithId(sheetClot, z.id)) return;
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
        // Skip duplicate entries based on productId + timestamp + type combo
        var dt = sh.timestamp ? new Date(sh.timestamp) : null;
        sheetStock.appendRow([
          dt && !isNaN(dt.getTime()) ? Utilities.formatDate(dt, 'Europe/Paris', 'dd/MM/yyyy') : '',
          dt && !isNaN(dt.getTime()) ? Utilities.formatDate(dt, 'Europe/Paris', 'HH:mm:ss') : '',
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
        'ID', 'Nom Client', 'Téléphone', 'Statut', 'Date Retrait', 'Heure', 
        'Articles', 'Total (€)', 'Acompte (€)', 'Reste à Payer (€)', 'État Paiement', 'Notes', 
        'Créé le', 'Début Production', 'Type', 'Parsed'
      ]);
      data.commandes.forEach(function(c) {
        var createdAt = c.createdAt || '';
        var total = parseFloat(c.totalPrice) || 0;
        var deposit = parseFloat(c.deposit) || 0;
        var remaining = Math.max(0, total - deposit);
        var paymentState = remaining <= 0 ? 'Payé' : (deposit > 0 ? 'Partiel' : 'Non payé');
        var row = [
          c.id, 
          c.customerName || '', 
          c.customerPhone || '',
          c.status || 'en_attente',
          c.pickupDate || '', 
          c.pickupTime || '',
          c.items || '',
          total, 
          deposit,
          remaining,
          paymentState,
          c.notes || '',
          createdAt,
          c.productionStartDate || '',
          c.type || 'Standard',
          JSON.stringify(c.parsedItems || [])
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

    // ---- 7. CLIENTS (upsert par ID) ----
    if (data.customers && data.customers.length > 0) {
      var sheetClients = getOrCreateSheet(ss, 'Clients', [
        'ID', 'Date Création', 'Nom Client', 'Téléphone', 'Email',
        'Adresse', 'Nombre de Visites', 'Total Dépensé (€)', 'Dernière Visite', 'Notes'
      ]);
      data.customers.forEach(function(c) {
        var createdDate = c.createdAt
          ? Utilities.formatDate(new Date(c.createdAt), 'Europe/Paris', 'dd/MM/yyyy HH:mm')
          : '';
        var lastVisit = c.lastVisit
          ? Utilities.formatDate(new Date(c.lastVisit), 'Europe/Paris', 'dd/MM/yyyy HH:mm')
          : '';
        var row = [
          c.id, createdDate, c.name || '', c.phone || '', c.email || '',
          c.address || '', c.visits || 0, c.totalSpent || 0, lastVisit, c.notes || ''
        ];
        upsertRow(sheetClients, c.id, row);
      });
      results.customers = data.customers.length + ' clients mis à jour';
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
      var cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30); 

      // --- Helpers ---
      function fmtVal(v) {
        if (v instanceof Date && !isNaN(v.getTime())) {
          if (v.getFullYear() < 1970) return Utilities.formatDate(v, 'Europe/Paris', 'HH:mm');
          return Utilities.formatDate(v, 'Europe/Paris', 'dd/MM/yyyy HH:mm');
        }
        var str = (v !== null && v !== undefined) ? String(v) : '';
        if (str.indexOf('Dec 30 1899') !== -1) return ''; 
        return str;
      }

      function parseDate(v) {
        if (v instanceof Date && !isNaN(v.getTime())) return v;
        if (typeof v === 'string') {
          var parts;
          if (v.match(/^\d{2}\/\d{2}\/\d{4}/)) {
            parts = v.split(/[\/\s:]/);
            return new Date(parts[2], parts[1]-1, parts[0], parts[3]||12, parts[4]||0);
          }
          if (v.match(/^\d{4}-\d{2}-\d{2}/)) return new Date(v);
        }
        return null;
      }

      function userDate(v) {
        var d = parseDate(v);
        if (!d || isNaN(d.getTime())) return '';
        if (d.getFullYear() < 1970) return '';
        return Utilities.formatDate(d, 'Europe/Paris', 'dd/MM/yyyy');
      }

      // ── Commandes actives ──
      var sheetCmd = ss.getSheetByName('Commandes');
      if (sheetCmd && sheetCmd.getLastRow() > 1) {
        var cmdData = sheetCmd.getDataRange().getValues();
        var commandes = [];
        for (var i = 1; i < cmdData.length; i++) {
          var row = cmdData[i];
          if (!row || row.length < 5) continue;
          
          var dRetrait = parseDate(row[4]);
          if (dRetrait && dRetrait < cutoff) continue;

          var parsedItems = [];
          try { parsedItems = JSON.parse(row[15] || '[]'); } catch(e) {}

          commandes.push({
            id: row[0],
            customerName: fmtVal(row[1]),
            customerPhone: fmtVal(row[2]),
            status: fmtVal(row[3]),
            pickupDate: userDate(row[4]),
            pickupTime: fmtVal(row[5]),
            items: fmtVal(row[6]),
            totalPrice: parseFloat(row[7]) || 0,
            deposit: parseFloat(row[8]) || 0,
            paymentStatus: fmtVal(row[10]),
            notes: fmtVal(row[11]),
            createdAt: fmtVal(row[12]),
            productionStartDate: userDate(row[13]),
            type: fmtVal(row[14]),
            parsedItems: parsedItems
          });
        }
        result.commandes = commandes;
      } else {
        result.commandes = [];
      }

      // ── Devis actifs ──
      var sheetDev = ss.getSheetByName('Devis');
      if (sheetDev && sheetDev.getLastRow() > 1) {
        var devData = sheetDev.getDataRange().getValues();
        var skipStatuses = ['converti', 'refuse', 'expire'];
        var devis = [];
        for (var j = 1; j < devData.length; j++) {
          var drow = devData[j];
          if (skipStatuses.indexOf(String(drow[11] || '')) !== -1) continue;
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

      // ── Catalogue ──
      var sheetCat = ss.getSheetByName('Catalogue');
      if (sheetCat && sheetCat.getLastRow() > 1) {
        var catData = sheetCat.getDataRange().getValues();
        var catalogue = [];
        for (var k = 1; k < catData.length; k++) {
          var crow = catData[k];
          catalogue.push({ id: crow[0], name: crow[1], price: crow[2], categoryName: crow[3], stock: crow[4], alertThreshold: crow[5], description: crow[6] });
        }
        result.catalogue = catalogue;
      } else {
        result.catalogue = [];
      }

      // ── Ventes (30 derniers jours) ──
      var sheetVentes = ss.getSheetByName('Ventes');
      if (sheetVentes && sheetVentes.getLastRow() > 1) {
        var ventesData = sheetVentes.getDataRange().getValues();
        var ventesMap = {}; 
        for (var v = 1; v < ventesData.length; v++) {
          var vrow = ventesData[v];
          if (!vrow || vrow.length < 8) continue;
          var saleId = String(vrow[0] || '');
          if (!saleId) continue;

          var dSaleStr = String(vrow[1] || '').split(' ')[0]; // Just the date part if it got implicitly converted
          var tSaleStr = String(vrow[2] || '');
          var combinedDate = null;
          
          if (dSaleStr && dSaleStr.indexOf('Dec 30') === -1) {
            // Usually formatted as DD/MM/YYYY
            if (dSaleStr.match(/^\d{2}\/\d{2}\/\d{4}/)) {
                var pDate = dSaleStr.split('/');
                // If time matches HH:mm:ss
                var h = 12, m = 0, s = 0;
                if (tSaleStr.match(/^\d{2}:\d{2}:\d{2}/)) {
                    var pTime = tSaleStr.split(':');
                    h = parseInt(pTime[0], 10);
                    m = parseInt(pTime[1], 10);
                    s = parseInt(pTime[2], 10);
                }
                combinedDate = new Date(pDate[2], parseInt(pDate[1], 10)-1, pDate[0], h, m, s);
            } else {
                combinedDate = parseDate(vrow[1]);
            }
          }

          if (combinedDate && combinedDate < cutoff) continue;

          if (!ventesMap[saleId]) {
            ventesMap[saleId] = {
              id: saleId,
              // Do NOT fall back to new Date() — if date is missing keep it empty
              timestamp: combinedDate && !isNaN(combinedDate.getTime()) ? combinedDate.toISOString() : '',

              total: 0,
              discount: parseFloat(vrow[8]) || 0,
              paymentMethod: String(vrow[9] || 'Espèces'),
              amountGiven: parseFloat(vrow[10]) || 0,
              change: parseFloat(vrow[11]) || 0,
              items: [],
              itemsCount: 0
            };
          }

          var artName = String(vrow[3] || '');
          var artQty  = parseInt(vrow[4]) || 1;
          var subtotal = parseFloat(vrow[6]) || 0;
          
          ventesMap[saleId].total += subtotal;
          if (artName && artName !== '(non détaillé)') {
            ventesMap[saleId].items.push({ name: artName, quantity: artQty, price: parseFloat(vrow[5]) || 0 });
            ventesMap[saleId].itemsCount += artQty;
          }
        }
        result.ventes = Object.values(ventesMap);
      } else {
        result.ventes = [];
      }

      var jsonString = JSON.stringify({ 
        status: 'ok', 
        commandes: result.commandes || [],
        devis: result.devis || [],
        catalogue: result.catalogue || [],
        ventes: result.ventes || []
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
  }
  
  // Vérifier si la feuille est vide ou si la première ligne (A1) est vide
  if (sheet.getLastRow() === 0 || sheet.getRange(1, 1).getValue() === "") {
    // Si la feuille contenait déjà des données mais pas d'en-tête, on insère une ligne
    if (sheet.getLastRow() > 0) {
      sheet.insertRowBefore(1);
    }
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f9a8d4');
    try { sheet.setFrozenRows(1); } catch(e) {}
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

// Vérifie si un ID existe déjà dans la colonne A d'une feuille
function rowExistsWithId(sheet, id) {
  if (!id) return false;
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return false;
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var strId = String(id);
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === strId) return true;
  }
  return false;
}
