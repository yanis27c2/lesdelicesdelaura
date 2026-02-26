function doPost(e) {
  // Configurer la réponse CORS (sinon la PWA sera bloquée par le navigateur)
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    // Parser les données JSON reçues de l'application
    var data = JSON.parse(e.postData.contents);
    var sales = data.sales; // Tableau des ventes à synchroniser
    
    // Obtenir la feuille "Ventes" ou la créer si elle n'existe pas
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Ventes");
    
    if (!sheet) {
      sheet = ss.insertSheet("Ventes");
      // Mettre les en-têtes pour la nouvelle feuille
      sheet.appendRow(["Date (ISO)", "Date d'enregistrement", "Total Vente (€)", "Nombre d'articles", "Détail des articles", "ID Transaction"]);
      sheet.getRange("A1:F1").setFontWeight("bold");
    }

    // Ajouter chaque vente dans la feuille
    for (var i = 0; i < sales.length; i++) {
       var sale = sales[i];
       
       // Formater le détail des articles
       var itemsDetail = sale.items.map(function(item) {
         return item.quantity + "x " + item.name;
       }).join(", ");
       
       sheet.appendRow([
         sale.timestamp, 
         new Date(sale.timestamp), 
         sale.total, 
         sale.itemsCount, 
         itemsDetail, 
         sale.id
       ]);
    }
    
    // Renvoyer un statut positif à l'application
    var result = {
      status: 'success',
      message: sales.length + ' ventes ajoutées avec succès'
    };
    output.setContent(JSON.stringify(result));
    
  } catch(error) {
    // Renvoyer l'erreur en cas de problème
    var result = {
      status: 'error',
      message: error.toString()
    };
    output.setContent(JSON.stringify(result));
  }
  
  return output;
}

// Fonction pour gérer la pré-requête CORS (OPTIONS) envoyée par le navigateur
function doOptions(e) {
  var output = ContentService.createTextOutput("");
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
