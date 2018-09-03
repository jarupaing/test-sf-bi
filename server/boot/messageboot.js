module.exports = function (app) {

  var postgreSQL = app.dataSources.postgreSQL;

  var models = [
    'Message',
  ]

  for (var i = 0; i < models.length; i++) {
    updateModel(models[i]);
  }

  function updateModel(model) {
    postgreSQL.isActual(model, function (err, actual) {
      if (actual) {
        console.log("Model is up-to-date: " + model);
      } else {
        console.log('Model is NOT up-to-date: ' + model);
        migrateModel(model);
      }
    });
  }

  function migrateModel(model) {
    postgreSQL.autoupdate(model, function () {
      console.log("Auto-update successful: " + model);
    });
  }

};
