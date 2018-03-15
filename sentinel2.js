/////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////// Dictionary ////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////

/*island boundaries. Here we have hashed out St. Croix, as we do not have training points for it. 
Adding taining points for St. Croix and anlayzing land use change on the island would be a great next  step.*/
var STThomas = ee.FeatureCollection('projects/USVI_Eco/boundary_stT');
var STJohn = ee.FeatureCollection('projects/USVI_Eco/boundary_stJ');
//var StCroix = ee.FeatureCollection('projects/USVI_Eco/boundary_stC');
var studyArea1 = {
  'St. Thomas': STThomas,
  'St. John': STJohn,
//'StCroix': StCroix
};

/*possible years for study, you can add future years once the imagery exists and is hosted in Google Earth Engine*/
var YEARS = {'2015': 2015, '2016': 2016, '2017': 2017, '2018': 2018};


////////////// Change for each island ////////////////////
/*add training points. We used the classes open space, barren, forest, development and water. 
These points were created on high-res imagery from the year cited. Creating new training points
from years closer to the year of study (such as high res 2017 imagery) may improve accuracy*/
var STJ2010 = 
 (ee.FeatureCollection('projects/USVI_Eco/2010TrainingPoints/OpenSpace_STJ_2010')).merge
 (ee.FeatureCollection('projects/USVI_Eco/2010TrainingPoints/Barren_STJ_2010')).merge
 (ee.FeatureCollection('projects/USVI_Eco/2010TrainingPoints/Forest_STJ_2010')).merge
 (ee.FeatureCollection('projects/USVI_Eco/2010TrainingPoints/HighDev_STJ_2010')).merge
 (ee.FeatureCollection('projects/USVI_Eco/2010TrainingPoints/Water_STJ_2010'));
var STT2010=
  (ee.FeatureCollection('projects/USVI_Eco/2010TrainingPoints/OpenSpace_STT_2010')).merge
  (ee.FeatureCollection('projects/USVI_Eco/2010TrainingPoints/Barren_STT_2010')).merge
  (ee.FeatureCollection('projects/USVI_Eco/2010TrainingPoints/Forest_STT_2010')).merge
  (ee.FeatureCollection('projects/USVI_Eco/2010TrainingPoints/HighDev_STT_2010')).merge
  (ee.FeatureCollection('projects/USVI_Eco/2010TrainingPoints/Water_STT_2010'));
var newfc1= {
  'StJ_2010': STJ2010,
  'StT_2010': STT2010
};

//DEM layers
var DEMT = ee.Image('projects/USVI_Eco/StT_DEM011');
var DEMJ = ee.Image('projects/USVI_Eco/StJ_DEM011');

/////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////// User Interface/////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////
//*****The following UI code was adapted from the Chile Water Resources Team 2017 Summer Code****

/* Create UI Panels */
var panel = ui.Panel({style: {width:'275px'}});
ui.root.insert(0,panel);

//intro
var intro = ui.Label('USVI Classification Tool', 
{fontWeight: 'bold', fontSize: '24px', margin: '10px 5px'}
);

var subtitle = ui.Label('This script analyzes sentinel-2 imagery',
  {margin: '0 0 0 12px',fontSize: '12px',color: 'gray'});
panel.add(intro).add(subtitle);

//select study area
var selectArea = ui.Select({
  items: Object.keys(studyArea1),
});
selectArea.setPlaceholder('Select area of study...');
panel.add(ui.Label('1. Select study area')).add(selectArea); 

//select year
var selectYear = ui.Select({
  items: Object.keys(YEARS),
});
selectYear.setPlaceholder('Select year of study...');
panel.add(ui.Label('2. Select year')).add(selectYear); 


/// Create Land Use Map
var mapbutton = ui.Label('3.Create Land Use Map');
panel.add(mapbutton);
panel.add(ui.Button("Create Map",landMap));
var additional_directions = ui.Label
  ('Classified Imagery may take up to a couple minutes to display. Click tasks to export classified image to drive. Click layers to flip from composite to classified image.', 
  {margin: '0 0 0 12px',fontSize: '12px',color: 'gray'});
panel.add(additional_directions);

var outputPanel = ui.Panel();
print(outputPanel);

/////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////// Define terms based on user input //////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////
function landMap(){
 var yearNum = (ee.Number.parse(selectYear.getValue()));
 var startDate = ee.Date.fromYMD(yearNum,1,1);
 var endDate = ee.Date.fromYMD(yearNum,12,31);
 var selectedStudy_name = selectArea.getValue();
 var studyArea = studyArea1[selectedStudy_name];
 var newfc = ee.Algorithms.If((selectedStudy_name=='St. John'), STJ2010, STT2010);
 var DEM = ee.Algorithms.If ((selectedStudy_name=='St. John'), DEMJ, DEMT);
 var elevation = ee.Image(DEM).select('b1').rename('elevation');
 var slope = ee.Terrain.slope(DEM);
 Map.centerObject(studyArea);

// SimpleCloudScore, an example of computing a cloud-free composite with L8
// by selecting the least-cloudy pixel from the collection.
// from https://code.earthengine.google.com/276375b2c68a3d8d76c277a548ea8d7d

// A mapping from a common name to the sensor-specific bands.
var S2_BANDS = [ 'B2',  'B3',   'B4', 'B8', 'B11',   'B12',   'B1', 'B10'];
var STD_NAMES = ['blue', 'green', 'red', 'nir', 'swir1', 'swir2', 'cb',  'cirrus'];

// Compute a cloud score.  This expects the input image to have the common
// band names: ["red", "blue", etc], so it can work across sensors.
var cloudScore = function(img) {
  img = img.select(S2_BANDS, STD_NAMES);
  // A helper to apply an expression and linearly rescale the output.
  var rescale = function(img, exp, thresholds) {
    return img.expression(exp, {img: img})
        .subtract(thresholds[0]).divide(thresholds[1] - thresholds[0]);
  };
  var score = ee.Image(1.0);
  score = score.min(rescale(img, 'img.cirrus', [0, 0.1]));
  score = score.min(rescale(img, 'img.cb', [0.5, 0.8]));
  return score.min(rescale(img.normalizedDifference(['green', 'swir1']), 'img', [0.8, 0.6]));
};

// Filter the TOA collection to a time-range and add the cloudscore band.
var collection = ee.ImageCollection('COPERNICUS/S2').select("B.*")
    .filterDate(startDate, endDate)
    .filterBounds(studyArea)
    .map(function(img) {
      img = img.divide(10000);
      // Invert the cloudscore so 1 is least cloudy, and rename the band.
      var score = cloudScore(img);
      score = ee.Image(1).subtract(score).select([0], ['cloudscore']);
      return img.addBands(score);
    });

// Define visualization parameters for a true color image.
var vizParams = {'bands': ['B4', 'B3', 'B2'], 'max': 0.4, 'gamma': 1.6};
//Map.addLayer(collection, vizParams, "collection", false);
//Map.addLayer(collection.qualityMosaic('cloudscore'), vizParams);


var collectionMosaic = collection.qualityMosaic('cloudscore');
var sentImg = collectionMosaic.clip(studyArea);
print('sentinel image', sentImg);

// calculate indices & add bands to final image

var ndvi = sentImg.normalizedDifference(['B8', 'B4']).select([0],['NDVI']); 
var ndwi = sentImg.normalizedDifference(['B3', 'B8']).select([0],['NDWI']); 
var ndbi = sentImg.normalizedDifference(['B11', 'B8']).select([0],['NDBI']); 

var finalImg = sentImg.addBands([ndvi, ndwi, ndbi, elevation, slope]).clip(studyArea);
print('final image', finalImg);

//Create a dictionary explaining the class meanings  
var classes = [
  {'landcover':1,'description':'Open Space'},
  {'landcover':2,'description':'Barren'},
  {'landcover':3,'description':'Forest'},
  {'landcover':4,'description':'ag'},
  {'landcover':5,'description':'Low Dev'},
  {'landcover':6,'description':'High Dev'},
  {'landcover':7,'description':'Water'},
];
print('Class Descriptions', classes);

//add a random number column to geometry imports, use seed (1, 2, and 3)
var newfc2 = ee.FeatureCollection(newfc).randomColumn('random', 2);
    print('newfc2', newfc2);
 
//define your classification samples to incl. newfc2 and the properties to be considered
var samples = finalImg.sampleRegions({
     collection: newfc2,   
     properties: ['landcover', 'random'], 
    scale: 10
});

//split training points (90% and 10%)  
var training = samples.filterMetadata('random', 'less_than', 0.9);
var testing = samples.filterMetadata('random', 'not_less_than', 0.9);

//only use the 90% for classification
var classifier = ee.Classifier.randomForest(100).train({
      features: training, 
     classProperty: 'landcover'
});

//apply classifier
var classified = finalImg.classify(classifier);

//to validate, compare 10% testing points to the classification product in errorMatrix
var validation = testing.classify(classifier);                                     
var errorMatrix = validation.errorMatrix('landcover', 'classification');           
print('Error Matrix:', errorMatrix);
print('Overall Accuracy:', errorMatrix.accuracy());
print('Kappa Coefficient: ', errorMatrix.kappa());


//color code CSS
var palette = ['000000', // Nodata - Black
              'eaec11', // Open space - yellow
              'ec7f11', // Barren - orange
              '43a360', // Forest - Dark green
              'd63000' , // Agriculture - not pictured
              'd6d6d6' , // Development - gray
              '3a95d6', // Water - blue
];
 
Map.addLayer(finalImg, vizParams, 'final image');
Map.addLayer(classified, 
    {min: 0, max: 7, palette: palette}, 'classification');

print('scale of Sentinel', classified.projection().nominalScale());
//print('scale of Sentinel2', finalImg.select('B2').projection().nominalScale().transform());

Export.image.toDrive({
  image: classified,
  folder: 'STJ_Sentinel_170726',
  description: 'CLASS_S2_2016_STJ',
  scale: 10,
  region: studyArea.geometry().bounds()
});
}
