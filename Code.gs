// ============================================================
// Les Délices de Laura — Google Apps Script
// Reçoit les données de la PWA et les écrit dans Google Sheets
// ID Sheet: 1WfxAHLu9WX_f66scD73w8B9lzXD_QAcArWcbgG4zy-Q
// ============================================================

var SPREADSHEET_ID = '1WfxAHLu9WX_f66scD73w8B9lzXD_QAcArWcbgG4zy-Q';

function doPost(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var results = {};

    // ---- 1. VENTES ---- (1 ligne par article)
    if (data.ventes && data.ventes.length > 0) {
      var sheetVentes = getOrCreateSheet(ss, 'Ventes', [
        'ID Vente', 'Date', 'Heure', 'Article', 'Quantité', 'Prix Unitaire (€)', 'Sous-total Article (€)',
        'Total Vente (€)', 'Remise (€)', 'Mode Paiement', 'Montant Donné (€)', 'Rendu (€)'
      ]);
      data.ventes.forEach(function(v) {
        var d = new Date(v.timestamp);
        var dateStr = Utilities.formatDate(d, 'Europe/Paris', 'dd/MM/yyyy');
        var heureStr = Utilities.formatDate(d, 'Europe/Paris', 'HH:mm:ss');
        // Une ligne par article dans cette vente
        if (v.items && v.items.length > 0) {
          v.items.forEach(function(item) {
            var prixUnitaire = parseFloat(item.price) || 0;
            var qte = parseInt(item.quantity) || 1;
            sheetVentes.appendRow([
              v.id,
              dateStr,
              heureStr,
              item.name,
              qte,
              prixUnitaire,
              Math.round(prixUnitaire * qte * 100) / 100,
              v.total || 0,
              v.discount || 0,
              v.paymentMethod || 'Espèces',
              v.amountGiven || 0,
              v.change || 0
            ]);
          });
        } else {
          // Vente sans détail d'article (cas rare)
          sheetVentes.appendRow([
            v.id, dateStr, heureStr, '(non détaillé)', 1, 0, 0,
            v.total || 0, v.discount || 0, v.paymentMethod || 'Espèces',
            v.amountGiven || 0, v.change || 0
          ]);
        }
      });
      results.ventes = data.ventes.length + ' ventes ajoutées';
    }

    // ---- 2. CATALOGUE (produits) ----
    if (data.catalogue && data.catalogue.length > 0) {
      var sheetCat = getOrCreateSheet(ss, 'Catalogue', [
        'ID', 'Nom', 'Prix (€)', 'Catégorie', 'Stock', 'Description'
      ]);
      // Vider et réécrire le catalogue complet (c'est un référentiel, pas un journal)
      var lastRow = sheetCat.getLastRow();
      if (lastRow > 1) sheetCat.deleteRows(2, lastRow - 1);
      data.catalogue.forEach(function(p) {
        sheetCat.appendRow([
          p.id, p.name, p.price, p.categoryName || p.categoryId, p.stock || 0, p.description || ''
        ]);
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
          d.amount || 0,
          d.reason || '',
          d.note || ''
        ]);
      });
      results.depenses = data.depenses.length + ' dépenses ajoutées';
    }

    // ---- 4. CLOTURES (rapports Z) ----
    if (data.clotures && data.clotures.length > 0) {
      var sheetClot = getOrCreateSheet(ss, 'Clotures', [
        'ID', 'Date Clôture', 'CA Total (€)', 'Nb Ventes', 'Espèces (€)', 'Carte (€)',
        'Total Dépenses (€)', 'Net Caisse (€)', 'Note'
      ]);
      data.clotures.forEach(function(z) {
        sheetClot.appendRow([
          z.id,
          z.date || '',
          z.totalRevenue || 0,
          z.totalSales || 0,
          z.cashTotal || 0,
          z.cardTotal || 0,
          z.totalExpenses || 0,
          z.netCash || 0,
          z.note || ''
        ]);
      });
      results.clotures = data.clotures.length + ' clôtures ajoutées';
    }

    // ---- 5. COMMANDES ----
    if (data.commandes && data.commandes.length > 0) {
      var sheetCmd = getOrCreateSheet(ss, 'Commandes', [
        'ID', 'Date Création', 'Nom Client', 'Téléphone', 'Date Retrait',
        'Total (€)', 'Acompte (€)', 'Reste à Payer (€)', 'Statut', 'Détail'
      ]);
      data.commandes.forEach(function(c) {
        sheetCmd.appendRow([
          c.id,
          c.createdAt ? Utilities.formatDate(new Date(c.createdAt), 'Europe/Paris', 'dd/MM/yyyy HH:mm') : '',
          c.customerName || '',
          c.customerPhone || '',
          c.pickupDate || '',
          c.total || 0,
          c.deposit || 0,
          (c.total || 0) - (c.deposit || 0),
          c.status || '',
          c.items ? c.items.map(function(i) { return i.quantity + 'x ' + i.name; }).join(', ') : ''
        ]);
      });
      results.commandes = data.commandes.length + ' commandes ajoutées';
    }

    output.setContent(JSON.stringify({ status: 'success', results: results }));

  } catch(error) {
    output.setContent(JSON.stringify({ status: 'error', message: error.toString() }));
  }

  return output;
}

// Utilitaire : récupère un onglet ou le crée avec les en-têtes
function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f9a8d4');
  }
  return sheet;
}

// Gestion CORS pre-flight
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}
