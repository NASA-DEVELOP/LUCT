/////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////// Dictionary ////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////

/*These elements are specific to the sensor and must be changed for LS5 imagery.*/
var vizParams = {bands: ['B4', 'B3', 'B2'], min: 0, max: 0.3, gamma: 1.3};
var collection = 'LANDSAT/LC8_SR'; 
var bandNames = ee.List(['B1','B2','B3','B4','B5','B6','B7','B9','elevation','slope']);
var sensor_band_dict =ee.Dictionary({
    L8 : ee.List([0,1,2,3,4,5,6,7,'elevation', 'slope']),
});

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
var YEARS = {'2013': 2013, '2014': 2014, '2015': 2015, '2016': 2016, '2017': 2017, '2018': 2018};

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
var panel = ui.Panel({style: {width:'300px'}});
ui.root.insert(0,panel);

//intro
var intro = ui.Label('USVI Classification Tool', 
{fontWeight: 'bold', fontSize: '24px', margin: '10px 5px'}
);

var subtitle = ui.Label('This script analyzes landsat 8 imagery',
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

/////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////// Create cloud free composite //////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////

//functions to add bands NDVI, NDWI, NDBI and mask using cf mask imagery
function bandFloat(img) {
  return img.toFloat().divide(10000);
}
function ndvi_calc(img){
  return img.normalizedDifference(['B5', 'B4']).select([0],['NDVI']); 
}
function ndwi_calc(img){
  return img.normalizedDifference(['B3', 'B5']).select([0],['NDWI']);
}
function ndbi_calc(img){
  return img.normalizedDifference(['B6', 'B5']).select([0],['NDBI']);
}
function addIndices(in_image){
    return in_image.addBands([ndvi_calc(in_image), ndwi_calc(in_image), ndbi_calc(in_image)]);
}
function addDEM(in_image){
    return in_image.addBands([elevation, slope]);
}
function mask_sr(image_sr) {
    var mask_band = image_sr.select('cfmask').lt(2);
    return image_sr.mask(mask_band);
}

//applies functions for gathering, cloud masking, and cloud shadow masking Landsat imagery
function LEDAPScfmaskImages(startDate,endDate,startJulian,endJulian){
  return ee.ImageCollection(collection)
        .filterDate(startDate,endDate)
        .filterBounds(ee.FeatureCollection(studyArea))
        .map(addDEM)
        .map(mask_sr)
        .select(sensor_band_dict.get('L8'),bandNames)
        .map(bandFloat)
        .map(addIndices); 
}
/*function to calculate maximum value composite based on NDVI percentile
parameters: landsat image collection, studyarea, percentile value*/
function maxvalcompNDVI(collection,studyArea,percc){
  
  var ndvi_loc=collection.select('NDVI').toArray().clip(studyArea)
  .arrayLength(0).multiply(percc/100).floor().int();
  
  var ndvi_loc2=collection.select('NDVI').toArray().clip(studyArea)
  .arrayLength(0).multiply(percc/100).add(1).floor().int();
  
  var bandNames=ee.Image(collection.first()).bandNames();
  var nb=ee.Image(collection.first()).bandNames().length().subtract(1);
  var out_list = ee.List.sequence(0,nb).map(function(i) {
  return collection.select([bandNames.get(i)])
  .toArray().arraySort().clip(studyArea)
  .arraySlice(0,ndvi_loc,ndvi_loc2, 1)
  .arrayFlatten([['0'],['0']]).rename([bandNames.get(i)]);});
  
  var first=out_list.slice(0,1).get(0);
  function combine(img, prev){return ee.Image(prev).addBands(img)}
  return ee.Image(out_list.slice(1,nb.add(1)).iterate(combine,first));
  
}//credits: Richard Massey, PhD student,  Northern Arizona University

//Get all images and cloud and shadow mask them
var allImages = LEDAPScfmaskImages(startDate,endDate);

//number of bands per season image
var nbf=ee.Image(allImages.first()).bandNames().length();

//reduce collections to maximum value composite based on NDVI percentile
var pctl=25; //range: 0-99
var compImage = maxvalcompNDVI(allImages,studyArea,pctl);
print('Output Image:',compImage);
Map.addLayer(compImage, vizParams, 'composite image');

/////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////// Classification ////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////
// **** the following is adapted from Everglades Fall 2016 Ecological Forescasting team code ******

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

 
//define your classification samples to incl. newfc2 and the properties to be considered
var samples = compImage.sampleRegions({
     collection: newfc2,   
     properties: ['landcover', 'random'], 
    scale: 30 
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
var classified = compImage.classify(classifier);

//to validate, compare 10% testing points to the classification product in errorMatrix
var validation = testing.classify(classifier);                                     
var errorMatrix = validation.errorMatrix('landcover', 'classification');           
print('Error Matrix:', errorMatrix);
print('Overall Accuracy:', errorMatrix.accuracy());
print('Kappa Coefficient: ', errorMatrix.kappa());


//color code CSS to display map 
var palette = ['000000', // Nodata - Black
              'eaec11', // Open space - yellow
              'ec7f11', // Barren - orange
              '43a360', // Forest - Dark green
              'd63000' , // Agriculture - not pictured
              'd6d6d6' , // Development - gray
              '3a95d6', // Water - blue
];
 
Map.addLayer(classified, 
    {min: 0, max: 7, palette: palette}, 'classification');


/*add ag mask. If analyzing St. Corix, ag must be included. To do so, we suggest adding the 
data as a mask instead of classifying points. The code below will acheive this */
//var maskag = function(classified){
//     var ag = classified.select('ag');    
//};

////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////EXPORT CODE ///////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////

//Export the classified image to the Drive (to finish the process, select run in 'Tasks')

Export.image.toDrive({
  image: classified,
  folder: 'DRIVE FOLDER',
  description: 'CLASSIFIED IMAGE', //change for each photo
  scale: 30,
  region: studyArea.geometry().bounds()
});


/*///////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////CREATE BAND CHART ///////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////



var im = compImage.addBands(classified);
print(im, 'im');

print(compImage,'classified bands');

var classNames = ee.List(['mask', 'barren', 'forest', 'develop', 'water']);

// Define a list of Landsat 8 wavelengths for X-axis labels.
var wavelengths = [0.44, 0.48, 0.56, 0.65, 0.86, 1.61, 2.2, 3.3];

// Define chart customization options.
var options = {
  lineWidth: 1,
  pointSize: 8,
  hAxis: {title: 'Wavelength (micrometers)'},
  vAxis: {title: 'Reflectance'},
  title: 'Spectra in classified img of St Thomas'
};

// Make the chart, set the options.
var chart = ui.Chart.image.byClass(
    im, 'classification', studyArea, ee.Reducer.max(), 500, classNames, wavelengths)
    .setOptions(options);

// Print the chart.
print(chart);
*/
}

