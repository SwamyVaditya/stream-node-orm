var async = require("async");
var stream = require('./GetStreamNode.js');

var Enricher = function(fields, options) {
  this.setFields(fields);
}

Enricher.prototype = {
  setFields: function(fields) {
    this.fields = fields || ['actor', 'object'];
  },
  isReference: function(value) {
    return (typeof(value) === 'string' && value.split(':').length == 2);
  },
  getClassFromRef: function(ref) {
    return stream.FeedManager.getActivityClass(ref);
  },
  collectReferences: function(activities) {
    var modelReferences = {};
    for (var i in activities) {
      var activity = activities[i];
      for (var i in this.fields) {
        var field = this.fields[i];
        if(!this.isReference(activity[field])) continue;
        var modelRef = activity[field].split(":")[0];
        var instanceRef = activity[field].split(":")[1];
        if (modelReferences[modelRef]){
          modelReferences[modelRef].push(instanceRef);
        } else {
          modelReferences[modelRef] = [instanceRef];
        }
      }
    }
    return modelReferences;
  },
  retreiveObjects: function (references, callback) {
    var objects = {};
    var self = this;
    async.each(Object.keys(references),
      function(modelRef, done){
        var refs = references[modelRef];
        var modelClass = self.getClassFromRef(modelRef);
        // TODO: send this as an error
        if (typeof(modelClass) === 'undefined') return done();
        if (typeof(objects[modelRef]) === 'undefined') objects[modelRef] = {};
        modelClass.loadFromStorage(refs, function(err, objectsIds) {
          for(var k in objectsIds){
            objects[modelRef][k] = objectsIds[k];
          }
          done(err);
        });
      },
      function(err){
        callback(err, objects);
      }
    );
  },
  enrichActivities: function(activities, callback) {
    var self = this;
    if (activities.length == 0) {
      callback(null, activities);
    }
    var references = this.collectReferences(activities);
    this.retreiveObjects(references, function(err, objects) {
      for (var i in activities) {
        var activity = activities[i];
        for (var j in self.fields) {
          var field = self.fields[j];
          if(!self.isReference(activity[field])) continue;
          var modelRef = activity[field].split(":")[0];
          var instanceRef = activity[field].split(":")[1];
          if (objects[modelRef] && objects[modelRef][instanceRef]){
            obj = JSON.parse(JSON.stringify(objects[modelRef][instanceRef]));

            for (key in obj) {
              activities[i][key] = obj[key];
            }
            // activities[i][field] = objects[modelRef][instanceRef];
          }
          // console.log(activities[i]);
        }
      }

      callback(err, activities);
    });
  },
  enrichAggregatedActivities: function(aggregatedActivities, callback) {
    if (aggregatedActivities.length == 0) {
      callback(null, aggregatedActivities);
    }

    self = this;

    async.each(Object.keys(aggregatedActivities),
      function(activityRef, done){
        // console.log('pre activities', aggregatedActivities[activityRef]['activities']);
        // console.log('prev activityRef', activityRef);

        self.enrichActivities(aggregatedActivities[activityRef]['activities'], function(err, aggregated) {
          // console.log('post activityRef', activityRef);
          aggregatedActivities[activityRef]['activities'] = aggregated;
          // console.log('post activities', aggregatedActivities[activityRef]['activities']);
          done(err);
        });

        // var refs = references[modelRef];
        // var modelClass = self.getClassFromRef(modelRef);
        // // TODO: send this as an error
        // if (typeof(modelClass) === 'undefined') return done();
        // if (typeof(objects[modelRef]) === 'undefined') objects[modelRef] = {};
        // modelClass.loadFromStorage(refs, function(err, objectsIds) {
        //   for(var k in objectsIds){
        //     objects[modelRef][k] = objectsIds[k];
        //   }
        //   done(err);
        // });
      },
      function(err){
        // console.log(aggregatedActivities);
        callback(err, aggregatedActivities);
      }
    );

    // for (var key in aggregatedActivities) {
    //   // console.log(aggregatedActivities[key]['activities']);
    //   console.log(key);
    //   var activity_id = key;

    //   this.enrichActivities(aggregatedActivities[key]['activities'], function(err, aggregated) {
    //     console.log('activity_id', activity_id);
    //     aggregatedActivities[key]['activities'] = aggregated;
    //   });
    // }

    // callback(null, aggregatedActivities);
  }
}

module.exports = Enricher;
