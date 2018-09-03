'use strict';
const sf = require('jsforce');
var dataError = [];

module.exports = function(Message) {
	var miConn;
    var chunkArray = 500;
 
  Message.beforeRemote('*', function(ctx, unused, next) {
    miConn = null;
    if(checkPermission(ctx.args.securityCode)) {
      getConnAPI(function(err, connAPI) {
        if (err) { return cb(err); }
        if (connAPI == null) { return cb(new Error('Invalid connAPI!')); }

        miConn = connAPI;
        miConn.bulk.pollInterval = 5000; // 5 sec
        miConn.bulk.pollTimeout = 120000; // 120 sec
        next();
      });

        } else {
          next(new Error('Fail'));
        }
  });
    function getTransaction(query, maxRecords, completeChunk, cb, insertTrasaction){
      miConn.bulk.query(query)
        .on('record', function(rec) {
          insertTrasaction(rec);
        }).on('error', function(err) {
          console.error(err);
        }).on('end', function(rec) {
          if(checkCompleteChunk(maxRecords, completeChunk)){
            return cb(null, 'Success');
          }
        })
    }
  Message.greet = function(msg, cb) {
    process.nextTick(function() {
      msg = msg || 'hello';
      cb(null, 'Sender says ' + msg + ' to receiver');
    });
  };
  Message.remoteMethod(
    'greet', {
      http: {
        path: '/greet',
        verb: 'get'
      },
      returns: {
        arg: 'status',
        type: 'string'
      }
    }
  );
  	Message.getBilling = function(securityCode, dateFrom, dateTo, cb) {
    var records = [];
    var idRecords = [];
    var completeChunk = 0;
    var maxRecords = 0;

    miConn.bulk.query("SELECT Id FROM Sales_Visit__c WHERE SystemModStamp >= " + dateFrom.toJSON() + " AND SystemModStamp <= " + dateTo.toJSON())
    .on("record", function(record) {
      records.push(record.Id);
    })
    .on("end", function() {
      //console.log("total in database : " + query.totalSize);
      //console.log("total fetched : " + query.totalFetched);
      //console.log(records);
      if(records.length <= 0){
        return cb(null, 'Success with no update');
      }else{
        retrieveTransaction(records);
      }
    })
    .on("error", function(err) {
      console.error(err);
    })

    function retrieveTransaction(records){
      idRecords = splitChunkArray(records, chunkArray);
      maxRecords = idRecords.length;
      console.log("total record of all array : " + maxRecords);

      for (var i = 0; i < idRecords.length; i++) {
        console.log("total record of" + i + "record size :"+ idRecords[i].length);
        var strIdValues = convertRecord(idRecords[i]);
        var query = "SELECT Id, Name, Account__c FROM Sales_Visit__c WHERE Id IN " + strIdValues + " LIMIT " + chunkArray;
        getTransaction(query, maxRecords, ++completeChunk, cb, function(rec) { insertBillingTransaction(rec); });
      }
    }

    function insertBillingTransaction(rec){
      var data ={
          'id'                        : rec.Id,
          'name'                      : rec.Name,
          'account'  		  		  : rec.Account__c,
        };

      Message.upsert(data, function(err, billing) {
       if (err) {
          console.log('Models created Error: \n', err);
          data.error = err;
          dataError.push(data);
        }else {
          console.log('Models created: \n', billing);
        }
      });
    }
  }

  Message.remoteMethod ( 'getBilling', {
    http:    { path: '/getBilling', verb: 'post' },
    accepts: [
      { arg: 'securityCode'  , type: 'string', default: 'AAaa123*' },
      { arg: 'dateFrom'    , type: 'date', default: '2017-10-04T00:00:00.000Z' },
      { arg: 'dateTo'    , type: 'date', default: '2017-10-04T00:00:00.000Z' }
    ],
    returns: { arg: 'status', type: 'string' }

  });
};
   /**
   * Returns an array with arrays of the given size.
   *
   * @param myArray {Array} Array to split
   * @param chunkSize {Integer} Size of every group
   */
  function splitChunkArray(myArray, chunk_size){
      var resultsSplit = [];

      while (myArray.length) {
          resultsSplit.push(myArray.splice(0, chunk_size));
      }

      return resultsSplit;
    }

    function convertRecord(records){
      var idValue = "( '"+ records[records.length-1] + "'";
      for (var i = records.length - 1; i >= 0; i--) {
        idValue = idValue + ", '" + records[i] + "'";
      }

      return idValue + ")";
    }


    function checkCompleteChunk(maxRecords, completeChunk){
        if(maxRecords == completeChunk){
          return true;
        }
        return false;
    }


    function checkPermission(securityCode){
      var permissionCode = process.env.PERMISSION_CODE || "AAaa123*";
      if (securityCode == permissionCode){
        return true;
      }
      return false;
    }
// ============================== getConnAPI ==============================

  function getConnAPI(cb) {

    var username = process.env.SFDC_API_USERNAME || "mobileintegration@siamcitycement.com.full";
    var password = process.env.SFDC_API_PASSWORD || "BBbb123*";

// ============================== use username & password to get loginSforce ==============================

    var conn = new sf.Connection({
      "oauth2" : {
        "loginUrl"    : process.env.SFDC_LOGIN_URL     || "https://test.salesforce.com",
        "grantType"   : process.env.SFDC_GRANT_TYPE    || "password",
        "clientId"    : process.env.SFDC_CLIENT_ID     || "3MVG959Nd8JMmavT2IGqAtf_hIb6lrhc9jHWJw0LCfYFg8QsHoc1NHV789.zi7BivK5s5TLUnI02XRkDvk8Wl",
        "clientSecret": process.env.SFDC_CLIENT_SECRET || "3346515942210976689"
      }
    });
    conn.login(username, password, function(err, login) {
      if (err) { return cb(err); }

// ============================== save loginSforce to DB; RETURN loginSforce ==============================

      var connAPI = new sf.Connection({
        "instanceUrl": conn.instanceUrl,
        "accessToken": conn.accessToken
      });

      return cb(null, connAPI);
    });
  }


